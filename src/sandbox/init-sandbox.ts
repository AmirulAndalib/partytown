import { CreateWorker, InitWebWorkerData, InstanceId, MainWindow } from '../types';
import { getInstanceId, setInstanceId } from './main-instances';
import { logMain } from '../utils';
import { mainAccessHandler } from './main-access-handler';
import { readMainInterfaces } from './read-interfaces';
import { readMainScripts } from './read-main-scripts';

export const initSandbox = async (
  sandboxWindow: Window,
  sandboxDocument: Document,
  createWebWorker: CreateWorker
) => {
  const key = Math.random();
  const mainWindow: MainWindow = sandboxWindow.parent!;
  const mainDocument = mainWindow.document;
  const currentLocationUrl = mainWindow.location + '';
  const config = mainWindow.partytown || {};
  const documentReadyState = mainDocument.readyState;
  const documentReferrer = mainDocument.referrer;
  const mainInterfaces = readMainInterfaces(sandboxDocument);
  const swContainer = sandboxWindow.navigator.serviceWorker;
  const swRegistration = await swContainer.getRegistration();

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
      $config$: config,
      $documentReadyState$: documentReadyState,
      $documentReferrer$: documentReferrer,
      $firstScriptId$: firstScriptId,
      $initializeScripts$: workerGroups[workerName],
      $interfaces$: mainInterfaces,
      $key$: key,
      $scopePath$: swRegistration!.scope!,
      $url$: currentLocationUrl,
    };
    logMain(
      `Creating "${workerName}" web worker, total scripts: ${initWebWorkerData.$initializeScripts$.length}`
    );
    const webWorker = createWebWorker(workerName);
    webWorker.postMessage(initWebWorkerData);
  }
};
