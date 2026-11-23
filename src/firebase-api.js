
const FIREBASE_API_KEY = 'AIzaSyCQ3h892fjZqYtpDAQewY7tX6gs2dZ3ijs';

export const FIREBASE_PROJECT_ID = 'richie-rich-bank';

const AUTH_URL = 'https://identitytoolkit.googleapis.com/v1';

const FIRESTORE_URL =
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Read Firebase responses safely, including empty responses.
async function handleResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      data.error?.message || 'Firebase request failed.'
    );
  }

  return data;
}

// Firebase Authentication: sign in.
export async function signInWithEmail(email, password) {
  const response = await fetch(
    `${AUTH_URL}/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  return handleResponse(response);
}

// Firebase Authentication: register.
export async function registerWithEmail(email, password) {
  const response = await fetch(
    `${AUTH_URL}/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  return handleResponse(response);
}

// Firebase Authentication: password reset.
export async function sendPasswordReset(email) {
  const response = await fetch(
    `${AUTH_URL}/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email,
      }),
    }
  );

  return handleResponse(response);
}

// Make an authenticated Firestore REST request.
export async function firestoreRequest(path, options = {}, idToken) {
  if (!idToken) {
    throw new Error('Please sign in first.');
  }

  const response = await fetch(`${FIRESTORE_URL}/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${idToken}`,
    },
  });

  return handleResponse(response);
}

// Convert Firestore REST values into normal JavaScript values.
function decodeValue(value) {
  if (!value) return null;

  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;

  if ('mapValue' in value) {
    return decodeFields(value.mapValue.fields || {});
  }

  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(decodeValue);
  }

  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      decodeValue(value),
    ])
  );
}

// Convert normal JavaScript values into Firestore REST values.
function encodeValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Firestore cannot store a non-finite number.');
    }

    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(encodeValue),
      },
    };
  }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: encodeFields(value),
      },
    };
  }

  throw new Error('Unsupported Firestore field value.');
}

function encodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      encodeValue(value),
    ])
  );
}

// Convert a Firestore document into a JavaScript record.
function decodeDocument(document) {
  return {
    id: document.name.split('/').pop(),
    ...decodeFields(document.fields || {}),
  };
}

// Read every document in a collection.
export async function listDocuments(collection, idToken) {
  const documents = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ pageSize: '100' });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const result = await firestoreRequest(
      `${collection}?${params.toString()}`,
      {},
      idToken
    );

    documents.push(
      ...(result.documents || []).map(decodeDocument)
    );

    pageToken = result.nextPageToken || '';
  } while (pageToken);

  return documents;
}

// Read one document.
export async function getDocument(collection, documentId, idToken) {
  const result = await firestoreRequest(
    `${collection}/${encodeURIComponent(documentId)}`,
    {},
    idToken
  );

  return decodeDocument(result);
}

// Create a document. If documentId is omitted, Firestore generates one.
export async function createDocument(
  collection,
  fields,
  idToken,
  documentId
) {
  const query = documentId
    ? `?documentId=${encodeURIComponent(documentId)}`
    : '';

  const result = await firestoreRequest(
    `${collection}${query}`,
    {
      method: 'POST',
      body: JSON.stringify({
        fields: encodeFields(fields),
      }),
    },
    idToken
  );

  return decodeDocument(result);
}

// Update selected fields in a document.
export async function updateDocument(
  collection,
  documentId,
  fields,
  idToken
) {
  const params = new URLSearchParams();

  Object.keys(fields).forEach(field => {
    params.append('updateMask.fieldPaths', field);
  });

  const result = await firestoreRequest(
    `${collection}/${encodeURIComponent(documentId)}?${params.toString()}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: encodeFields(fields),
      }),
    },
    idToken
  );

  return decodeDocument(result);
}

// Delete a document.
export async function deleteDocument(collection, documentId, idToken) {
  return firestoreRequest(
    `${collection}/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
    idToken
  );
}
