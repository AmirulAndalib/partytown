import { callRefHandler } from './worker-serialization';
import { initNextScriptsInWebWorker } from './worker-script';
import { initWebWorker } from './init-worker';
import {
  InitWebWorkerData,
  MessageFromSandboxToWorker,
  MessageFromWorkerToSandbox,
  WorkerMessageType,
} from '../types';
import { len } from '../utils';
import { webWorkerCtx } from './worker-constants';

const postMessage = (msg: MessageFromWorkerToSandbox) => self.postMessage(msg);

self.onmessage = (ev: MessageEvent<MessageFromSandboxToWorker>) => {
  const msg = ev.data;
  const msgType = msg[0];

  if (msgType === WorkerMessageType.MainDataResponseToWorker) {
    // initialize the web worker with the received the main data
    initWebWorker(self as any, msg[1] as InitWebWorkerData);
    // send back to main that the web worker is initialized
    postMessage([WorkerMessageType.WorkerInitialized]);
  } else if (msgType === WorkerMessageType.InitializeNextWorkerScript) {
    // message from main to web worker that it should initialize the next script
    initNextScriptsInWebWorker();

    if (len(webWorkerCtx.$initializeScripts$)) {
      // send back to main that there is another script to do yet
      // doing this postMessage back-and-forth so we don't have long running tasks
      postMessage([WorkerMessageType.InitializeNextWorkerScript]);
    }
  } else if (msgType === WorkerMessageType.RefHandlerCallback) {
    // main has called a ref handler
    callRefHandler(msg[1] as number, msg[2]!, msg[3]!);
  }
};

// web worker started up
// request the data from main
postMessage([WorkerMessageType.MainDataRequestFromWorker]);
