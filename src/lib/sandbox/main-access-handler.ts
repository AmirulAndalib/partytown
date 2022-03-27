import {
  ApplyPath,
  ApplyPathType,
  MainAccessRequest,
  MainAccessResponse,
  MainAccessTask,
  PartytownWebWorker,
  WinId,
} from '../types';
import { debug, getConstructorName, isPromise, len } from '../utils';
import { defineCustomElement } from './main-custom-element';
import { deserializeFromWorker, serializeForWorker } from './main-serialization';
import { getInstance, setInstanceId } from './main-instances';
import { normalizedWinId } from '../log';
import { winCtxs } from './main-constants';

export const mainAccessHandler = async (
  worker: PartytownWebWorker,
  accessReq: MainAccessRequest
) => {
  let accessRsp: MainAccessResponse = {
    $msgId$: accessReq.$msgId$,
  };
  let totalTasks = len(accessReq.$tasks$);
  let i = 0;
  let task: MainAccessTask;
  let winId: WinId;
  let applyPath: ApplyPath;
  let instance: any;
  let rtnValue: any;
  let isLast: boolean;

  for (; i < totalTasks; i++) {
    try {
      isLast = i === totalTasks - 1;
      task = accessReq.$tasks$[i];
      winId = task.$winId$;
      applyPath = task.$applyPath$;

      console.log('mainAccessHandler', applyPath, 1);

      if (!winCtxs[winId] && winId.startsWith('f_')) {
        console.log('mainAccessHandler', applyPath, 2);
        // window (iframe) hasn't finished loading yet
        await new Promise<void>((resolve) => {
          let check = 0;
          let callback = () => {
            if (winCtxs[winId] || check++ > 1000) {
              resolve();
            } else {
              requestAnimationFrame(callback);
            }
          };
          callback();
        });
        console.log('mainAccessHandler', applyPath, 3);
      }

      if (
        applyPath[0] === ApplyPathType.GlobalConstructor &&
        applyPath[1] in winCtxs[winId]!.$window$
      ) {
        console.log('mainAccessHandler', applyPath, 4);
        setInstanceId(
          new (winCtxs[winId]!.$window$ as any)[applyPath[1]](
            ...deserializeFromWorker(worker, applyPath[2])
          ),
          task.$instanceId$
        );
      } else {
        console.log('mainAccessHandler', applyPath, 5);
        // get the existing instance
        instance = getInstance(winId, task.$instanceId$);
        if (instance) {
          rtnValue = applyToInstance(
            worker,
            winId,
            instance,
            applyPath,
            isLast,
            task.$groupedGetters$
          );

          if (task.$assignInstanceId$) {
            console.log('mainAccessHandler', applyPath, 6);
            if (typeof task.$assignInstanceId$ === 'string') {
              console.log('mainAccessHandler', applyPath, 7);
              setInstanceId(rtnValue, task.$assignInstanceId$);
            } else {
              console.log('mainAccessHandler', applyPath, 8);
              winCtxs[task.$assignInstanceId$.$winId$] = {
                $winId$: task.$assignInstanceId$.$winId$,
                $window$: {
                  document: rtnValue,
                } as any,
              };
            }
          }

          if (isPromise(rtnValue)) {
            console.log('mainAccessHandler', applyPath, 9);
            rtnValue = await rtnValue;
            if (isLast) {
              accessRsp.$isPromise$ = true;
            }
          }
          if (isLast) {
            console.log('mainAccessHandler', applyPath, 10);
            accessRsp.$rtnValue$ = serializeForWorker(winId, rtnValue);
          }
        } else {
          if (debug) {
            accessRsp.$error$ = `Error finding instance "${
              task.$instanceId$
            }" on window ${normalizedWinId(winId)}`;
            console.error(accessRsp.$error$, task);
          } else {
            accessRsp.$error$ = task.$instanceId$ + ' not found';
          }
        }
      }
    } catch (e: any) {
      if (isLast!) {
        // last task is the only one we can throw a sync error
        accessRsp.$error$ = String(e.stack || e);
      } else {
        // this is an error from an async setter, but we're
        // not able to throw a sync error, just console.error
        console.error(e);
      }
    }
  }

  return accessRsp;
};

const applyToInstance = (
  worker: PartytownWebWorker,
  winId: WinId,
  instance: any,
  applyPath: ApplyPath,
  isLast: boolean,
  groupedGetters?: string[]
) => {
  let i = 0;
  let l = len(applyPath);
  let next: any;
  let current: any;
  let previous: any;
  let args: any[];
  let groupedRtnValues: any;

  for (; i < l; i++) {
    current = applyPath[i];
    next = applyPath[i + 1];
    previous = applyPath[i - 1];

    try {
      if (!Array.isArray(next)) {
        if (typeof current === 'string' || typeof current === 'number') {
          // getter
          if (i + 1 === l && groupedGetters) {
            // instead of getting one property, we actually want to get many properties
            // This is useful for getting all dimensions of an element in one call
            groupedRtnValues = {};
            groupedGetters.map((propName) => (groupedRtnValues[propName] = instance[propName]));
            return groupedRtnValues;
          }

          // current is the member name, but not a method
          console.log('applyToInstance', instance[current], 1);
          instance = instance[current];
        } else if (next === ApplyPathType.SetValue) {
          // setter
          // previous is the setter name
          // current is the setter value
          // next tells us this was a setter
          console.log('applyToInstance', current, 2);
          instance[previous] = deserializeFromWorker(worker, current);
          console.log('applyToInstance', current, 3);

          // setters never return a value
          return;
        } else if (typeof instance[previous] === 'function') {
          // method call
          // current is the method args
          // previous is the method name
          args = deserializeFromWorker(worker, current);

          if (previous === 'define' && getConstructorName(instance) === 'CustomElementRegistry') {
            args[1] = defineCustomElement(winId, worker, args[1]);
          }

          if (previous === 'insertRule') {
            // possible that the async insertRule has thrown an error
            // and the subsequent async insertRule's have bad indexes
            if (args[1] > len(instance.cssRules)) {
              args[1] = len(instance.cssRules);
            }
          }

          console.log('applyToInstance', current, 4);

          instance = instance[previous].apply(instance, args);
          console.log('applyToInstance', current, 5);
          if (previous === 'play') {
            return Promise.resolve();
          }
        }
      }
    } catch (err) {
      if (isLast) {
        throw err;
      } else {
        if (debug) {
          console.debug(`Non-blocking setter error:`, err);
        } else {
          console.debug(err);
        }
      }
    }
  }

  return instance;
};
