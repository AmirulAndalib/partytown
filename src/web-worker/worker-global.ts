import { createElement } from './worker-node';
import { InstanceId, InterfaceType, NodeName } from '../types';
import { InstanceIdKey } from './worker-constants';
import { setLocation, WorkerLocation } from './worker-location';
import { webWorkerCtx } from './worker-constants';
import { WorkerDocument } from './worker-document';

export const initWebWorkerGlobal = (self: any) => {
  self[InstanceIdKey] = InstanceId.window;

  const doc = new WorkerDocument({
    $instanceId$: InstanceId.document,
    $interfaceType$: InterfaceType.Document,
    $nodeName$: NodeName.Document,
  });

  Object.defineProperties(self, {
    document: {
      get() {
        return doc;
      },
    },
    Image: {
      get() {
        return class {
          constructor() {
            return createElement(doc, 'img', []);
          }
        };
      },
    },
    location: {
      get() {
        return new WorkerLocation(webWorkerCtx.$url$);
      },
      set(url: string) {
        setLocation(url);
      },
    },
  });

  self.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 16);
  self.cancelAnimationFrame = (id: number) => clearTimeout(id);

  self.self = self.parent = self.top = self.window = self;
};
