import {
  AccessType,
  ImmediateSetter,
  InterfaceType,
  MainAccessRequest,
  MainAccessRequestTask,
  MainAccessResponse,
  NodeName,
  PlatformInstanceId,
  SerializedTransfer,
} from '../types';
import { constructInstance } from './worker-constructors';
import {
  debug,
  len,
  logWorkerCall,
  logWorkerGetter,
  logWorkerSetter,
  PT_PROXY_URL,
  randomId,
} from '../utils';
import { deserializeFromMain, serializeForMain } from './worker-serialization';
import { getInstanceStateValue, setInstanceStateValue } from './worker-state';
import {
  ImmediateSettersKey,
  InstanceIdKey,
  InterfaceTypeKey,
  NodeNameKey,
  ProxyKey,
  taskQueue,
  webWorkerCtx,
  WinIdKey,
} from './worker-constants';
import type { WorkerInstance } from './worker-instance';

const queueTask = (
  instance: WorkerInstance,
  $accessType$: AccessType,
  $memberPath$: string[],
  $data$?: SerializedTransfer | undefined,
  $immediateSetters$?: ImmediateSetter[],
  $newInstanceId$?: number
) => {
  const winId = instance[WinIdKey];
  const winQueue = (taskQueue[winId] = taskQueue[winId] || []);

  const $forwardToWin$ = webWorkerCtx.$winId$ !== winId;

  const accessReqTask: MainAccessRequestTask = {
    $instanceId$: instance[InstanceIdKey],
    $interfaceType$: instance[InterfaceTypeKey],
    $nodeName$: instance[NodeNameKey],
    $accessType$,
    $memberPath$,
    $data$,
    $immediateSetters$,
    $newInstanceId$,
  };

  winQueue.push(accessReqTask);
  return drainQueue(winId, instance, $memberPath$, $forwardToWin$, winQueue);
};

const drainQueue = (
  $winId$: number,
  instance: WorkerInstance,
  $memberPath$: string[],
  $forwardToWin$: boolean,
  queue: MainAccessRequestTask[]
) => {
  if (len(queue)) {
    const accessReq: MainAccessRequest = {
      $msgId$: randomId(),
      $winId$,
      $forwardToWin$,
      $tasks$: [...queue],
    };
    queue.length = 0;

    const xhr = new XMLHttpRequest();
    const accessReqStr = JSON.stringify(accessReq);
    xhr.open('POST', webWorkerCtx.$scopePath$ + PT_PROXY_URL, false);
    xhr.send(JSON.stringify(accessReq));

    // look ma, i'm synchronous (•‿•)

    const accessRsp: MainAccessResponse = JSON.parse(xhr.responseText);

    const errors = accessRsp.$errors$.join();
    const isPromise = accessRsp.$isPromise$;
    const rtn = deserializeFromMain(instance, $memberPath$, accessRsp.$rtnValue$!);

    if (errors) {
      if (debug) {
        console.error(self.name, accessReqStr);
      }
      if (isPromise) {
        return Promise.reject(errors);
      }
      throw new Error(errors);
    }

    if (isPromise) {
      return Promise.resolve(rtn);
    }
    return rtn;
  }
};

export const getter = (instance: WorkerInstance, memberPath: string[]) => {
  applyBeforeSyncSetters(instance[WinIdKey], instance);

  const rtn = queueTask(instance, AccessType.Get, memberPath);
  logWorkerGetter(instance, memberPath, rtn);
  return rtn;
};

export const setter = (instance: WorkerInstance, memberPath: string[], value: any) => {
  logWorkerSetter(instance, memberPath, value);

  if (instance[ImmediateSettersKey]) {
    instance[ImmediateSettersKey]!.push([memberPath, serializeForMain(value)]);
  } else {
    const serializedValue = serializeForMain(value);

    if (typeof value === 'function') {
      setInstanceStateValue(instance, memberPath.join('.'), value);
    }

    queueTask(instance, AccessType.Set, memberPath, serializedValue);
  }
};

export const callMethod = (
  instance: WorkerInstance,
  memberPath: string[],
  args: any[],
  immediateSetters?: ImmediateSetter[],
  newInstanceId?: number
) => {
  applyBeforeSyncSetters(instance[WinIdKey], instance);
  const rtn = queueTask(
    instance,
    AccessType.CallMethod,
    memberPath,
    serializeForMain(args),
    immediateSetters,
    newInstanceId
  );
  logWorkerCall(instance, memberPath, args, rtn);
  return rtn;
};

export const applyBeforeSyncSetters = (winId: number, instance: WorkerInstance) => {
  const beforeSyncValues = instance[ImmediateSettersKey];
  if (beforeSyncValues) {
    instance[ImmediateSettersKey] = undefined;

    const winDoc = constructInstance(
      InterfaceType.Document,
      PlatformInstanceId.document,
      winId,
      NodeName.Document
    );
    const syncedTarget = callMethod(
      winDoc,
      ['createElement'],
      [instance[NodeNameKey]],
      beforeSyncValues,
      instance[InstanceIdKey]
    );

    if (debug && instance[InstanceIdKey] !== syncedTarget[InstanceIdKey]) {
      console.error('Main and web worker instance ids do not match', instance, syncedTarget);
    }
  }
};

const createComplexMember = (
  interfaceType: InterfaceType,
  instance: WorkerInstance,
  memberPath: string[]
) => {
  const interfaceInfo = webWorkerCtx.$interfaces$.find((i) => i[0] === interfaceType);
  if (interfaceInfo) {
    const memberTypeInfo = interfaceInfo[1];
    const memberInfo = memberTypeInfo[memberPath[len(memberPath) - 1]];
    if (memberInfo === InterfaceType.Method) {
      return (...args: any[]) => callMethod(instance, memberPath, args);
    } else if (memberInfo > InterfaceType.Window) {
      return proxy(memberInfo, instance, [...memberPath]);
    }
  }

  const stateValue = getInstanceStateValue<Function>(instance, memberPath.join('.'));
  if (typeof stateValue === 'function') {
    return (...args: any[]) => stateValue.apply(instance, args);
  }

  return null;
};

export const proxy = <T = any>(
  interfaceType: InterfaceType,
  target: T,
  initMemberPath: string[]
): T => {
  if (
    !target ||
    (typeof target !== 'object' && typeof target !== 'function') ||
    (target as any)[ProxyKey] ||
    String(target).includes('[native')
  ) {
    return target;
  }

  return new Proxy<any>(target, {
    get(target, propKey) {
      if (propKey === ProxyKey) {
        return true;
      }

      if (Reflect.has(target, propKey)) {
        return Reflect.get(target, propKey);
      }

      const memberPath = [...initMemberPath, String(propKey)];
      const complexProp = createComplexMember(interfaceType, target, memberPath);
      if (complexProp) {
        return complexProp;
      }

      return getter(target, memberPath);
    },

    set(target, propKey, value, receiver) {
      if (Reflect.has(target, propKey)) {
        Reflect.set(target, propKey, value, receiver);
      } else {
        setter(target, [...initMemberPath, String(propKey)], value);
      }
      return true;
    },
  });
};
