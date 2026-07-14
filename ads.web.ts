type AdListener = () => void;

const AdEventType = {
  LOADED: 'loaded',
  CLOSED: 'closed',
} as const;

const interstitial = {
  addAdEventListener: (_event: string, _listener: AdListener) => () => {},
  load: () => {},
  show: () => {},
};

export { AdEventType, interstitial };
