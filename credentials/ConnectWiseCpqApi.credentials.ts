import type {
  IAuthenticateGeneric,
  ICredentialDataDecryptedObject,
  ICredentialType,
  IDataObject,
  IHttpRequestHelper,
  IHttpRequestMethods,
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
      type: 'string',
      default: '',
      description:
        'Access key from CPQ (visible in the URL when logged in). Used as prefix in Basic auth username',
      required: true,
    },
    {
      displayName: 'Public Key',
      name: 'publicKey',
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
  ];

  // Build the HTTP Basic Authorization header using CPQ 2022.2+ API key format:
  // username: accessKey+publicKey, password: privateKey
  // Authorization: Basic base64(accessKey+PublicKey:PrivateKey)
  // eslint-disable-next-line @typescript-eslint/require-await
  preAuthentication = async function (
    this: IHttpRequestHelper,
    credentials: ICredentialDataDecryptedObject,
  ): Promise<IDataObject> {
    const accessKey = (credentials.accessKey as string) || '';
    const publicKey = (credentials.publicKey as string) || '';
    const privateKey = (credentials.privateKey as string) || '';

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
      },
    },
  };

  // Simple GET to verify authentication and headers
  test = {
    request: {
      baseURL: '={{$credentials.baseUrl || "https://sellapi.quosalsell.com"}}',
      url: '/api/quotes',
      method: 'GET' as IHttpRequestMethods,
      qs: {
        page: 1,
        pageSize: 1,
      },
    },
  };
}
