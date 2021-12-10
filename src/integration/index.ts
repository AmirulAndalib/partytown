import PartytownSnippet from '@snippet';
import type {
  PartytownConfig,
  PartytownForwardProperty,
  PartytownForwardPropertyName,
  PartytownForwardPropertyType,
} from '../lib/types';

/**
 * @public
 */
export const partytownSnippet = (config: PartytownConfig) => {
  const forward = config.forward || [];
  delete config.forward;

  const configStr = JSON.stringify(config, (k, v) => {
    if (typeof v === 'function') {
      v = String(v);
      if (v.startsWith(k + '(')) {
        v = 'function ' + v;
      }
    }
    return v;
  });

  return [
    `!(function(w,p,f,c){`,
    config && Object.keys(config).length > 0
      ? `c=w[p]=Object.assign(w[p]||{},${configStr});`
      : `c=w[p]=w[p]||{};`,
    `c[f]=(c[f]||[])`,
    forward.length > 0 ? `.concat(${JSON.stringify(forward)})` : ``,
    `})(window,'partytown','forward');`,
    PartytownSnippet,
  ].join('');
};

/**
 * Gracefully adds a forward property to the global Partytown config. This
 * first ensures the `window.partytown.foward` exists, then adds the forward
 * property.
 *
 * @public
 */
export const appendForward = (forward: PartytownForwardProperty) => {
  if (Array.isArray(forward)) {
    return appendForwardProperty(forward[0], forward[1]);
  }
  return ``;
};

const appendForwardProperty = (
  propertyName: PartytownForwardPropertyName,
  propertyType?: PartytownForwardPropertyType
) =>
  `!(function(w,p,f,c){c=w[p]=w[p]||{};(c[f]=c[f]||[]).push(${JSON.stringify(
    propertyType ? [propertyName, propertyType] : [propertyName]
  )})})(window,'partytown','forward');`;

export { SCRIPT_TYPE } from '../lib/utils';

export type { PartytownConfig, PartytownForwardPropertyName, PartytownForwardPropertyType };

export * from './services/facebook-pixel';
export * from './services/google-tag-manager';
