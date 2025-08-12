import type {
  IAuthenticateGeneric,
  ICredentialDataDecryptedObject,
  ICredentialType,
  IDataObject,
  IHttpRequestHelper,
  INodeProperties,
} from 'n8n-workflow';

/**
 * ConnectWise CPQ (Sell) API credentials.
 *
 * Builds a Basic Authorization header using CPQ 2022.2+ API key format: username:
 * accessKey+publicKey, password: privateKey.
 */
export class ConnectWiseCpqApi implements ICredentialType {
  name = 'connectWiseCpqApi';
  displayName = 'ConnectWise CPQ (Sell) API';
  documentationUrl = 'https://developer.connectwise.com/Products';

  properties: INodeProperties[] = [
    {
      displayName: 'Access Key',
      name: 'accessKey',
      // eslint-disable-next-line
      type: 'string',
      default: '',
      description:
        'Use the CPQ site key from the Sell URL when logged in (e.g. https://connectwise.quosalsell.com/QuosalWeb/home?accesskey=<accesskey>…).',
      required: true,
    },
    {
      displayName: 'Public Key',
      name: 'publicKey',
      // eslint-disable-next-line
      type: 'string',
      default: '',
      description: 'Public API key created in CPQ (Settings → Organisation Settings → API Keys)',
      required: true,
    },
    {
      displayName: 'Private Key',
      name: 'privateKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Private API key created in CPQ (shown only once when creating the key)',
      required: true,
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://sellapi.quosalsell.com',
      description: 'Base URL for the CPQ API. Only change if instructed by ConnectWise support',
    },
    {
      displayName: 'Enable Debug Logging',
      name: 'enableDebug',
      type: 'boolean',
      default: false,
      description:
        'When enabled, logs masked request details (method, URL, query, headers) and response status to the console',
    },
  ];

  // Build the HTTP Basic Authorization header using CPQ 2022.2+ API key format:
  // username: accessKey+publicKey, password: privateKey
  // Authorization: Basic base64(accessKey+PublicKey:PrivateKey)
  preAuthentication = async function (
    this: IHttpRequestHelper,
    credentials: ICredentialDataDecryptedObject,
  ): Promise<IDataObject> {
    const accessKey = ((credentials.accessKey as string) || '').trim();
    const publicKey = ((credentials.publicKey as string) || '').trim();
    const privateKey = ((credentials.privateKey as string) || '').trim();

    const username = `${accessKey}+${publicKey}`;
    const token = Buffer.from(`${username}:${privateKey}`, 'utf8').toString('base64');
    return { data: token } as IDataObject;
  };

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        ['Authorization']: '={{"Basic " + $auth.data}}',
        ['Content-Type']: 'application/json; version=1.0',
        ['Accept']: 'application/json',
        ['User-Agent']: 'n8n-connectwise-cpq',
      },
    },
  };

}
