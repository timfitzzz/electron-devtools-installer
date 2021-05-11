import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

import { getPath, downloadFile, changePermissions, removeUnsupportedManifestKeys, removeUnsupportedFolders } from './utils';

const unzip: any = require('unzip-crx-3');

const downloadChromeExtension = (
  chromeStoreIDOrURI: string,
  forceDownload?: boolean,
  attempts = 5,
): Promise<string> => {
  let storeOrDirect = 'store';
  let chromeStoreID = chromeStoreIDOrURI;
  if (chromeStoreIDOrURI.indexOf('https://') > -1) {
    console.log('found extension direct download url: ', chromeStoreIDOrURI);
    storeOrDirect = 'direct';
    chromeStoreID = chromeStoreIDOrURI.substr(
      chromeStoreIDOrURI.lastIndexOf('/'),
      chromeStoreIDOrURI.lastIndexOf('.'),
    );
  }

  const extensionsStore = getPath();
  if (!fs.existsSync(extensionsStore)) {
    fs.mkdirSync(extensionsStore, { recursive: true });
  }

  const extensionFolder = path.resolve(`${extensionsStore}/${chromeStoreID}`);
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(extensionFolder) || forceDownload) {
      if (fs.existsSync(extensionFolder)) {
        rimraf.sync(extensionFolder);
      }
      const fileURL =
        storeOrDirect === 'direct'
          ? chromeStoreIDOrURI
          : `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&x=id%3D${chromeStoreID}%26uc&prodversion=32`; // eslint-disable-line
      const filePath = path.resolve(`${extensionFolder}.crx`);
      downloadFile(fileURL, filePath)
        .then(() => {
          unzip(filePath, extensionFolder)
            .then(() => {
              changePermissions(extensionFolder, 755);
              removeUnsupportedManifestKeys(extensionFolder);
              removeUnsupportedFolders(extensionFolder);
              resolve(extensionFolder);
            })
            .catch((err: Error) => {
              if (!fs.existsSync(path.resolve(extensionFolder, 'manifest.json'))) {
                return reject(err);
              }
            });
        })
        .catch((err) => {
          console.log(`Failed to fetch extension, trying ${attempts - 1} more times`); // eslint-disable-line
          if (attempts <= 1) {
            return reject(err);
          }
          setTimeout(() => {
            downloadChromeExtension(chromeStoreIDOrURI, forceDownload, attempts - 1)
              .then(resolve)
              .catch(reject);
          }, 200);
        });
    } else {
      resolve(extensionFolder);
    }
  });
};

export default downloadChromeExtension;
