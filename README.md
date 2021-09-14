# Partytown 🎉

[![hackmd-github-sync-badge](https://hackmd.io/cfpOAVjyQCi2TcKNCSU5GA/badge)](https://hackmd.io/cfpOAVjyQCi2TcKNCSU5GA)

> A fun location for your third-party scripts to hang out

⚠️ Warning! This is experimental! ⚠️

Partytown is a `5kb` library to help relocate resource intensive scripts into a [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), and off of the [main thread](https://developer.mozilla.org/en-US/docs/Glossary/Main_thread). Its goal is to help speed up sites by dedicating the main thread to your code, and offloading third-party scripts to a web worker.

- [Information](#information)
  - [Negative Impacts From Third-Party Scripts](#negative-impacts-from-Third-Party-Scripts)
  - [Goals](#goals)
  - [Web Workers](#web-workers)
  - [Browser Window And DOM Access](#browser-window-and-dom-access)
  - [Sandboxing](#sandboxing)
  - [Trade-Offs](#trade-offs)
  - [Use-Cases](#use-cases)
  - [How Does It Work?](#how-does-it-work)
  - [Browser Features And Fallback](#browser-features-and-fallback)
- [Usage](#usage)
  - [Partytown Library](#partytown-library)
  - [React](#react)
  - [Vanilla](#vanilla)
  - [Config](#config)
  - [Debugging](#debugging)
  - [Distribution](#distribution)
- [Development](https://github.com/BuilderIO/partytown/blob/main/DEVELOPER.md#local-development)
  - [Installation](https://github.com/BuilderIO/partytown/blob/main/DEVELOPER.md#installation)
  - [Submitting Issues](https://github.com/BuilderIO/partytown/blob/main/DEVELOPER.md#submitting-issues-and-writing-tests)
  - [Manual Testing](https://github.com/BuilderIO/partytown/blob/main/DEVELOPER.md#manual-testing)
  - [E2E Testing](https://github.com/BuilderIO/partytown/blob/main/DEVELOPER.md#e2e-testing)
  - [Deployed Tests](https://github.com/BuilderIO/partytown/blob/main/DEVELOPER.md#deployed-tests)
- [Community](#community)
- [Related Projects](#related-projects)

---

## Information

### Negative Impacts From Third-Party Scripts

Even with a fast and higly tuned site and/or app following all of the best practices, it's all too common for your performance wins to be erased the moment third-party scripts are added. By third-party scripts we mean code that is embedded within your site, but not directly under your control. A few examples include: analytics, metrics, ads, A/B testing, trackers, etc. Their inclusion are often a double-edged sword.

Below is a summary of potential issues, referenced from [Loading Third-Party JavaScript](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/loading-third-party-javascript):

- Firing too many network requests to multiple servers. The more requests a site has to make, the longer it can take to load.
- Sending too much JavaScript which keeps the main thread busy. Too much JavaScript can block DOM construction, delaying how quickly pages can render.
- CPU-intensive script parsing and execution can delay user interaction and cause battery drain.
- Third-party scripts that were loaded without care can be a single-point of failure (SPOF).
- Insufficient HTTP caching, forcing resources to be fetched from the network often.
- The use of legacy APIs (e.g `document.write()`), which are known to be harmful to the user experience.
- Excessive DOM elements or expensive CSS selectors.
- Including multiple third-party embeds that can lead to multiple frameworks and libraries being pulled in several times, which exacerbates the performance issues.
- Third-party scripts also often use embed techniques that can block `window.onload`, even if the embed is using async or defer.

### Goals

We set out to solve this situation, so that apps of all sizes will be able to continue to use third-party scripts without the performance hit. Some of Partytown's goals include:

- Free up main thread resources to be used only for the primary web app execution.
- Sandbox third-party scripts and allow or deny their access main thread APIs.
- Isolate long-running tasks within the web worker thread.
- Reduce layout thrashing coming from third-party scripts.
- Throttle third-party scripts' access to the main thread.
- Allow third-party scripts to run exactly how they're coded and without any alterations.
- Read and write main thread DOM operations _synchronously_ from within a web worker, allowing scripts running from the web worker to execute as expected.
- No build-steps or bundling required, but rather update scripts the same way as traditional third-party scripts are updated.

### Web Workers

Partytown's philosophy is that the main thead should be dedicated to your code, and any scripts that are not required to be in the [critical path](https://developers.google.com/web/fundamentals/performance/critical-rendering-path) should be moved to a web worker. Main thread performance is, without question, more important than web worker thread performance. See the [example page](https://partytown.vercel.app/example/) and [test pages](https://partytown.vercel.app/) for some live demos.

> If you're looking to run _your_ app within a web worker, we recommend the [WorkerDom](https://github.com/ampproject/worker-dom) project.

### Browser Window And DOM Access

Traditionallly, communicating between the main thread and worker thread _must_ be [asyncrounous](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Concepts). Meaning that for the two threads to communicated, they cannot use blocking calls.

Party town is different. It allows code executed from the web worker to access DOM _synchronously_. The benefit from this is that third-party scripts can continue to work exactly how they're coded.

For example, the code below works as expected within a web worker:

```javascript
const rects = element.getClientRects();
console.log(rects.x, rects.y);
```

First thing you'll notice is that there's no async/await, promise or callback. Instead, the call to `getClientRects()` is blocking, and the returned `rects` value contains the explected x and y properties.

Additionally, data passed between the main thread and web worker must be [serializable](https://en.wikipedia.org/wiki/Serialization). Partytown automatically handles the serializing and deserializing of data passed between threads.

### Sandboxing

Third-party scripts are often a black-box with large amounts of code. What's buried within the obfuscated code is difficult to tell. It's minified for good reason, but regardless it becomes very difficult to understand what third-party scripts are executing on _your_ site and _your_ user's devices.

Partytown on the other hand, is able to isolate and sandbox third-party scripts within a web worker, and allow, or deny, access to main thread APIs. This includes cookies, localStorage, or the entire document. Because the code is executed within the worker, and their access to the main thread _must_ go through the proxy, Partytown is able to give developers control over what the scripts that can execute.

Essentially, Partytown lets you:

- Isolate third-party scripts within a sandbox ([web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)).
- Configure which browser APIs specific scripts can, and cannot, execute.
- Option to log API calls and passed in arguments in order to give better insight as to what the scripts are doing.

#### Partytown Debug Logs

With debug and logging enabled, below is an example of the Partytown logs showing all calls, getters and setters:

![Partytown Console Logs](https://user-images.githubusercontent.com/452425/131688576-e207cb15-7ce5-4009-a358-3e3093d51957.png)

## Trade-Offs

Nothing is without trade-offs. Using Partytown to orchestrate third-party scripts vs adding them to your pages has the following considerations to keep in mind:

- Partytown library scripts must be hosted from the same origin as the HTML document (not a CDN).
- DOM operations within the worker are purposely throttled, slowing down execution compared to the same code running on the main thread. (We also see this as a feature.)
- A total of three threads are used: Main Thread, Web Worker, Service Worker (in the future we may explore [Atomics](#what-about-atomics) which would bring it down to two).
- Not ideal for scripts that are required to block the main document (blocking is bad).
- `event.preventDefault()` will have no effect, similar to [passive event listeners](https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md).
- Trade-offs with intercepted network requests:
  - Many service worker network requests may show up in the network tab.
  - Partytown service worker requests are intercepted by the client, and transfer `0 bytes` over the network.
  - [Lighthouse scores](https://web.dev/performance-scoring/) are unaffected by the intercepted requests (any work on thread other than `main` has no impact on Lighthouse).

## Use-Cases

Below are just a few examples of third-party scripts that might be a good candidate to run from within a web worker. The goal is to continue validating commonly used services to ensure Partytown has the correct API proxies, but Partytown itself should not hardcode to any specific services. Help us test!

- [Google Tag Manager (GTM)](https://marketingplatform.google.com/about/tag-manager/)
- [Google Analytics (GA)](https://analytics.google.com/)
- [Mixpanel](https://mixpanel.com/)
- [Hubspot](https://www.hubspot.com/)
- [Segment](https://segment.com/)
- [Amplitude](https://amplitude.com/)

### How Does It Work?

Partytown relies on [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [JavaScript Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), and a communcation layer between them all.

1. Scripts are disabled from running on the main thread by using the `type="text/partytown"` attribute on the `<script/>` tag.
1. Service worker creates an `onfetch` handler to intercept specific requests.
1. Web worker is given the scripts to execute within the worker thread.
1. Web worker creates JavaScript Proxies to replicate and forward calls to the main thread APIs (such as DOM operations).
1. Any call to the JS proxy uses [_syncrounous_ XHR](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Synchronous_and_Asynchronous_Requests#example_http_synchronous_request) requests.
1. Service worker intercepts requests, then is able to asyncrounsly communicate with the main thread.
1. When the service worker receives the results from the main thead, it responds to the web worker's request.
1. From the point of view of code executing on the web worker, everything was synchronous, and each call to the document was blocking.

#### What About Atomics?

[Atomics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics) are the latest and greatest way to accomplish the challenge of _synchronously_ sending data between the main thread and the web worker. Honestly, it looks like Atomics may be the preferred and "correct" way to perform these tasks. However, as of right now, more research is needed into how Atomics could be used in production.

Currently, [Safari does not support Atomics](https://caniuse.com/mdn-javascript_builtins_atomics) due to [Spectre Attacks: Exploiting Speculative Execution](https://spectreattack.com/spectre.pdf). When Spectre attacks were first documented, the other browsers removed Atomics too, but they have since added it back. Due to this uncertainy, we're opting for a solution that works everywhere, today. That said, we'd love to do more research here and hopefully migrate to use Atomics in the future, and use the current system as the fallback.

### Browser Features And Fallback

- [Web Worker](https://caniuse.com/webworkers)
- [Service Worker](https://caniuse.com/serviceworkers)
- [JavaScript Proxy](https://caniuse.com/proxy)
- [JavaScript Symbol](https://caniuse.com/mdn-javascript_builtins_symbol)

If the browser does not support any of the features above, then it'll fallback to run third-party scripts the traditional way.

## Usage

### Partytown Library

Each third-party script that shouldn't run in the main thread, but instead party 🎉 in a web worker, should set the `type` attribute of its opening script tag to `text/partytown`. This does two things:

1. Prevents the script from executing on the main thread.
2. Provides an attribute selector for the Partytown library.

```html
<script type="text/partytown">
  // Third-party analytics scripts
</script>
```

### React

A React `<Partytown/>` component is provided within [@builder.io/partytown/react](https://www.npmjs.com/package/@builder.io/partytown). The component is simply a wrapper to the [vanilla HTML](#vanilla) example below, and similarly should be added within the document's `<head>`. Below is an example of the React `<Partytown/>` component used within a [Next.js Document](https://nextjs.org/docs/advanced-features/custom-document).

```jsx
import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <Partytown />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
```

### Vanilla

To load Partytown with just HTML, the library script below should be added within the `<head>` of page. The snippet will patch any global variables needed so other library scripts, such as Google Tag Manager's [Data Layer](https://developers.google.com/tag-manager/devguide), continues to work. However, the actual Partytown library, and any of the third-party scripts, are not downloaded or executed until after the document has loaded.

<!-- prettier-ignore -->
```html
<!--Partytown-->
<script>
(function(){var t,e=window,p=document,a=e.partytown||{},n=p.createElement("script");e._ptf=[],(a.forward||[]).map((p=>{t=e,p.split(".").map(((a,n,r)=>{t=t[a]=n<r.length-1?t[a]||{}:function(){e._ptf.push(p,arguments)}}))})),n.async=n.defer=!0,n.src="/~partytown/partytown."+(a.debug?"debug.js":"js"),p.head.appendChild(n)})();
</script>
<!--End Partytown-->
```

Note that the loaded script _must_ be hosted from the same origin as the HTML page, rather than a CDN. Additionally, the Partytown library should be
hosted from its own dedicated root directory `/~partytown/`. This root directory becomes the [scope](https://developers.google.com/web/ilt/pwa/introduction-to-service-worker#registration_and_scope) for the service worker, and all client-side requests within that path are intercepted by Partytown.

With scripts disabled from executing, the Partytown library can lazily begin loading and executing the scripts from inside a worker.

### Copy Tasks

An additional requirement is that the `/~partytown/` directory should serves the static files found within [@builder.io/partytown/lib](https://unpkg.com/browse/@builder.io/partytown/lib/). The quickest way is to just copy the JavaScript files to the public directory of your server. Another option would be to setup a copy task within the project's bundler, such as Webpack.

### Config

Before the Partytown library script, you can configure the `partytown` global object, such as:

```html
<script>
  partytown = {...};
</script>
<script src="/~partytown/partytown.js" async defer></script>
```

### Debugging

When using the `partytown.debug.js` file there is a minimal set of default debug logs available that print in the console. You can also opt-in to list out even more verbose logs that may help to debug scripts.

```html
<script>
  partytown = {
    logCalls: true,
    logGetters: true,
    logSetters: true,
    logImageRequests: true,
    logScriptExecution: true,
    logStackTraces: true,
  };
</script>
<script src="/~partytown/partytown.debug.js" async defer></script>
```

> Note that debug logs and configuration is not available in the `partytown.js` version.

### Distribution

The distribution comes with multiple files:

- `/~partytown/partytown.js`

  - The initial script to be loaded on the main thread.
  - Minified and property renamed.
  - Console logs removed.
  - Contents of `partytown.js` could be inlined in the HTML instead to reduce an extra HTTP request.
  - Loads:
    - `partytown-sw.js`: Minified service worker with inlined sandbox and web worker.

- `/~partytown/partytown.debug.js`

  - Debug version of `/~partytown/partytown.js`.
  - Additional request for sandbox and web worker.
  - Not minified.
  - Includes console logs.
  - Loads other debug library scripts.
  - Not meant for production, but useful to inspect what scripts are up to.
  - Loads:
    - `partytown-sw.debug.js`: Service worker with separate sandbox request.
    - `partytown-sandbox.debug.js`: Sandbox with separate web worker request.
    - `partytown-ww.debug.js`: Web worker as separate file, not inlined.

---

## Community

- [Partytown Discord](https://discord.gg/hbuEtxdEZ3)
- [@QwikDev](https://twitter.com/QwikDev)
- [@builderio](https://twitter.com/builderio)
- [Development](https://github.com/BuilderIO/partytown/blob/main/DEVELOPER.md#local-development)

## Related Projects

- [Qwik](https://github.com/BuilderIO/qwik): An open-source framework designed for best possible time to interactive, by focusing on resumability of server-side-rendering of HTML, and fine-grained lazy-loading of code.
- [Mitosis](https://github.com/BuilderIO/mitosis): Write components once, run everywhere. Compiles to Vue, React, Solid, Angular, Svelte, and more.
- [Builder](https://github.com/BuilderIO): Drag and drop page builder and CMS for React, Vue, Angular, and more.
