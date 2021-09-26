import { CacheControl, ContentType, response } from './response';
import { debug } from '../utils';
import type { MainAccessRequest, MainAccessResponse } from '../types';

const resolves = new Map<number, MessageResolve>();

export const receiveMessageFromSandboxToServiceWorker = (ev: ExtendableMessageEvent) => {
  const accessRsp: MainAccessResponse = ev.data;

  const r = resolves.get(accessRsp.$msgId$);
  if (r) {
    resolves.delete(accessRsp.$msgId$);
    clearTimeout(r[1]);
    r[0](accessRsp);
  }
};

const sendMessageToSandboxFromServiceWorker = (
  self: ServiceWorkerGlobalScope,
  accessReq: MainAccessRequest
) =>
  new Promise<MainAccessResponse>(async (resolve) => {
    const clients = await self.clients.matchAll();
    const client = [...clients].sort((a, b) => {
      if (a.url > b.url) return -1;
      if (a.url < b.url) return 1;
      return 0;
    })[0];

    if (client) {
      const timeout = debug ? 120000 : 10000;
      const msgResolve: MessageResolve = [
        resolve,
        setTimeout(() => {
          resolves.delete(accessReq.$msgId$);
          resolve(swMessageError(accessReq, `Timeout`));
        }, timeout),
      ];
      resolves.set(accessReq.$msgId$, msgResolve);
      client.postMessage(accessReq);
    } else {
      resolve(swMessageError(accessReq, `No Party`));
    }
  });

const swMessageError = (accessReq: MainAccessRequest, err: string) => ({
  $winId$: accessReq.$winId$,
  $msgId$: accessReq.$msgId$,
  $tasks$: [],
  $errors$: [err],
});

export const httpRequestFromWebWorker = (self: ServiceWorkerGlobalScope, req: Request) =>
  new Promise<Response>(async (resolve) => {
    const accessReq: MainAccessRequest = await req.clone().json();
    const responseData = await sendMessageToSandboxFromServiceWorker(self, accessReq);

    resolve(response(JSON.stringify(responseData), ContentType.JSON, CacheControl.NoStore));
  });

type MessageResolve = [(data?: any) => void, any];
