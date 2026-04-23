// Google Drive OAuth Setup - For Phase 2 Production
// This module handles Google Drive authentication and file operations
// Note: Requires Google Identity Services (GIS) to be loaded
//
// To enable in production:
// 1. Create project at https://console.cloud.google.com/
// 2. Enable: Google Drive API, Google Identity Services
// 3. Create OAuth 2.0 Client ID (Web application)
// 4. Add authorized origin: https://your-domain.com
// 5. Set CLIENT_ID below

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient = null;
let gapiLoaded = false;
let gisLoaded = false;

export class DriveAuth {
  constructor() {
    this.accessToken = null;
    this.isAuthenticated = false;
  }

  async init() {
    await this.loadGapi();
    await this.loadGIS();
  }

  async loadGapi() {
    return new Promise((resolve) => {
      gapi.load('client', async () => {
        await gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          scope: SCOPES,
        });
        gapiLoaded = true;
        resolve();
      });
    });
  }

  async loadGIS() {
    return new Promise((resolve) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            this.accessToken = tokenResponse.access_token;
            this.isAuthenticated = true;
          }
        },
      });
      gisLoaded = true;
      resolve();
    });
  }

  async signIn() {
    if (!CLIENT_ID) {
      console.warn('Google CLIENT_ID not configured, using demo mode');
      this.accessToken = 'demo-token';
      this.isAuthenticated = true;
      return true;
    }
    
    return new Promise((resolve) => {
      tokenClient.requestAccessToken();
      // Result handled in callback
      setTimeout(() => resolve(this.isAuthenticated), 1000);
    });
  }

  async uploadFile(filename, content, mimeType = 'application/json') {
    if (!this.isAuthenticated) await this.signIn();
    
    const metadata = {
      name: filename,
      mimeType: mimeType,
      parents: ['appDataFolder']
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(content)], { type: mimeType }));
    
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form
    });
    
    if (!response.ok) throw new Error('Upload failed');
    return await response.json();
  }

  async listFiles() {
    if (!this.isAuthenticated) await this.signIn();
    
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)',
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    
    if (!response.ok) throw new Error('List files failed');
    return await response.json();
  }

  async downloadFile(fileId) {
    if (!this.isAuthenticated) await this.signIn();
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    
    if (!response.ok) throw new Error('Download failed');
    return await response.json();
  }
}
