import { CreateWorker, InitWebWorkerData, InstanceId } from '../types';
import { getInstanceId, setInstanceId } from './main-instances';
import { logMain } from '../utils';
import { mainAccessHandler } from './main-access-handler';
import { readImplementations } from './read-interfaces';
import { readMainScripts } from './read-main-scripts';

export const initSandbox = async (sandboxWindow: Window, createWebWorker: CreateWorker) => {
  const key = Math.random();
  const mainWindow = sandboxWindow.parent!;
  const mainDocument = mainWindow.document;
  const currentLocationUrl = mainWindow.location + '';
  const documentCookie = mainDocument.cookie;
  const documentReadyState = mainDocument.readyState;
  const documentReferrer = mainDocument.referrer;
  const swContainer = sandboxWindow.navigator.serviceWorker;
  const swRegistration = await swContainer.getRegistration();

  const methodNames = readImplementations(mainWindow, mainDocument);
  const workerGroups = readMainScripts(mainDocument);
  const firstScriptId = getInstanceId(mainDocument.querySelector('script'));

  setInstanceId(mainWindow, InstanceId.window);
  setInstanceId(mainDocument, InstanceId.document);

  swContainer.addEventListener('message', (ev) => {
    requestAnimationFrame(async () => {
      const accessRsp = await mainAccessHandler(key, ev.data);
      if (swRegistration && swRegistration.active) {
        swRegistration.active.postMessage(accessRsp);
      }
    });
  });

  logMain(`Loaded sandbox for ${currentLocationUrl}`);

  for (const workerName in workerGroups) {
    const initWebWorkerData: InitWebWorkerData = {
      $currentLocationUrl$: currentLocationUrl,
      $documentCookie$: documentCookie,
      $documentReadyState$: documentReadyState,
      $documentReferrer$: documentReferrer,
      $firstScriptId$: firstScriptId,
      $initializeScripts$: workerGroups[workerName],
      $key$: key,
      $methodNames$: methodNames,
      $scopePath$: swRegistration!.scope!,
    };
    logMain(
      `Creating "${workerName}" web worker group, total scripts: ${initWebWorkerData.$initializeScripts$.length}`
    );
    const webWorker = createWebWorker(workerName);
    webWorker.postMessage(initWebWorkerData);
  }
};
