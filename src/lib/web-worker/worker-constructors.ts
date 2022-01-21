import { htmlMedia, lazyLoadMedia } from './worker-media';
import type { Node } from './worker-node';
import { nodeConstructors, webWorkerInstances } from './worker-constants';

export const getOrCreateNodeInstance = (
  winId: number,
  instanceId: number,
  nodeName: string,
  namespace?: string,
  instance?: Node
) => {
  instance = webWorkerInstances.get(instanceId);
  if (!instance) {
    instance = createNodeInstance(winId, instanceId, nodeName, namespace);
    webWorkerInstances.set(instanceId, instance);
  }
  return instance;
};

export const createNodeInstance = (
  winId: number,
  instanceId: number,
  nodeName: string,
  namespace?: string
) => {
  if (htmlMedia.includes(nodeName)) {
    lazyLoadMedia();
  }

  const NodeCstr: typeof Node = nodeConstructors[nodeName]
    ? nodeConstructors[nodeName]
    : nodeName.includes('-')
    ? nodeConstructors.UNKNOWN
    : (self as any).HTMLElement;

  return new NodeCstr(winId, instanceId, [], nodeName, namespace);
};
