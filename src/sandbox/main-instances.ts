import { InstanceId } from '../types';
import { len } from '../utils';

let instanceIds = InstanceId.body + 1;
let cleanupInc = 0;

const instances: [number, InstanceType][] = [];
const InstanceIdKey = Symbol();

export const setInstanceId = (instance: InstanceType | null | undefined, instanceId: number) => {
  if (instance) {
    instances.push([instanceId, instance]);
    instance[InstanceIdKey] = instanceId;

    cleanupInc++;
    if (cleanupInc > 99) {
      cleanupInc = 0;
      while (true) {
        let disconnectedNodes = instances.filter((i) => i[1].nodeType && !i[1].isConnected);
        let i: number;
        let l: number;
        if (len(disconnectedNodes) > 99) {
          for (i = 0, l = len(instances); i < l; i++) {
            if (!instances[i][1].isConnected) {
              instances.slice(i, 1);
              break;
            }
          }
        } else {
          break;
        }
      }
    }
  }
};

export const getInstanceId = (instance: InstanceType | null | undefined, instanceId?: number) => {
  if (instance) {
    instanceId = instance[InstanceIdKey];
    if (typeof instanceId !== 'number') {
      instanceId = instanceIds++;
      setInstanceId(instance, instanceId);
    }
    return instanceId;
  }
  return -1;
};

export const getInstance = <T = InstanceType | null>(instanceId: number, instanceItem?: any): T => {
  instanceItem = instances.find((i) => i[0] === instanceId);
  return instanceItem ? instanceItem[1] : null;
};

interface InstanceObj {
  [InstanceIdKey]?: number;
  [key: string]: any;
}

interface InstanceNode extends Node, InstanceObj {}

interface InstanceWindow extends Window, InstanceObj {}

interface InstanceHistory extends History, InstanceObj {}

interface InstanceStorage extends Storage, InstanceObj {}

type InstanceType = InstanceNode | InstanceWindow | InstanceHistory | InstanceStorage;
