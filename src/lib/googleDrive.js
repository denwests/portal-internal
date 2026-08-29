const GOOGLE_IDENTITY_SCRIPT =
  "https://accounts.google.com/gsi/client";

const DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";


let accessToken = "";
let tokenExpiresAt = 0;
let tokenClient = null;
let loadingScriptPromise = null;


/* =========================================================
   LOAD GOOGLE IDENTITY SERVICES
========================================================= */

function loadGoogleIdentityScript() {

  if (
    window.google?.accounts?.oauth2
  ) {
    return Promise.resolve();
  }


  if (
    loadingScriptPromise
  ) {
    return loadingScriptPromise;
  }


  loadingScriptPromise =
    new Promise(
      (
        resolve,
        reject
      ) => {

        const existing =
          document.querySelector(
            `script[src="${GOOGLE_IDENTITY_SCRIPT}"]`
          );


        if (existing) {

          existing.addEventListener(
            "load",
            () => resolve(),
            {
              once: true,
            }
          );

          existing.addEventListener(
            "error",
            () =>
              reject(
                new Error(
                  "Google Identity Services gagal dimuat."
                )
              ),
            {
              once: true,
            }
          );

          return;
        }


        const script =
          document.createElement(
            "script"
          );

        script.src =
          GOOGLE_IDENTITY_SCRIPT;

        script.async = true;
        script.defer = true;


        script.onload =
          () => resolve();


        script.onerror =
          () =>
            reject(
              new Error(
                "Google Identity Services gagal dimuat."
              )
            );


        document.head.appendChild(
          script
        );

      }
    );


  return loadingScriptPromise;
}


/* =========================================================
   ACCESS TOKEN
========================================================= */

export function hasDriveAccess() {

  return Boolean(
    accessToken &&
    Date.now() <
      tokenExpiresAt -
        60_000
  );

}


export function clearDriveAccess() {

  accessToken = "";
  tokenExpiresAt = 0;

}


/* =========================================================
   REQUEST GOOGLE DRIVE ACCESS
========================================================= */

export async function requestDriveAccess() {

  const clientId =
    import.meta.env
      .VITE_GOOGLE_CLIENT_ID;


  if (!clientId) {

    throw new Error(
      "VITE_GOOGLE_CLIENT_ID belum diisi. Ikuti README_GALLERY_MVP.txt terlebih dahulu."
    );

  }


  if (
    hasDriveAccess()
  ) {

    return accessToken;

  }


  await loadGoogleIdentityScript();


  return new Promise(
    (
      resolve,
      reject
    ) => {

      if (!tokenClient) {

        tokenClient =
          window.google.accounts.oauth2
            .initTokenClient({

              client_id:
                clientId,

              scope:
                DRIVE_SCOPE,

              callback:
                () => {},

            });

      }


      tokenClient.callback =
        (
          response
        ) => {

          if (
            response?.error
          ) {

            reject(
              new Error(
                response.error_description ||
                response.error
              )
            );

            return;
          }


          if (
            !response?.access_token
          ) {

            reject(
              new Error(
                "Google Drive tidak memberikan access token."
              )
            );

            return;
          }


          accessToken =
            response.access_token;


          tokenExpiresAt =
            Date.now() +
            Number(
              response.expires_in ||
              3600
            ) *
              1000;


          resolve(
            accessToken
          );

        };


      tokenClient.requestAccessToken({

        prompt:
          accessToken
            ? ""
            : "consent",

      });

    }
  );

}


/* =========================================================
   DRIVE FETCH
========================================================= */

async function driveFetch(
  url,
  options = {},
  token = accessToken
) {

  if (!token) {

    throw new Error(
      "Google Drive belum terhubung."
    );

  }


  const response =
    await fetch(
      url,
      {

        ...options,

        headers: {

          Authorization:
            `Bearer ${token}`,

          ...(
            options.headers ||
            {}
          ),

        },

      }
    );


  if (
    response.status === 401
  ) {

    clearDriveAccess();

  }


  return response;
}


/* =========================================================
   CREATE GALLERY FOLDER
========================================================= */

export async function createGalleryFolder(
  folderName,
  token = accessToken
) {

  const response =
    await driveFetch(

      "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink",

      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

        },

        body:
          JSON.stringify({

            name:
              folderName,

            mimeType:
              "application/vnd.google-apps.folder",

          }),

      },

      token

    );


  if (
    !response.ok
  ) {

    throw new Error(
      `Gagal membuat folder Google Drive (${response.status}).`
    );

  }


  const folder =
    await response.json();


  /* =======================================================
     MAKE FOLDER PUBLIC
  ======================================================= */

  const permissionResponse =
    await driveFetch(

      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        folder.id
      )}/permissions`,

      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

        },

        body:
          JSON.stringify({

            type:
              "anyone",

            role:
              "reader",

            allowFileDiscovery:
              false,

          }),

      },

      token

    );


  if (
    !permissionResponse.ok
  ) {

    await deleteDriveItem(
      folder.id,
      token
    ).catch(
      () => {}
    );


    throw new Error(
      `Gagal membagikan folder Google Drive (${permissionResponse.status}).`
    );

  }


  return {

    id:
      folder.id,

    name:
      folder.name,

    url:
      `https://drive.google.com/drive/folders/${folder.id}`,

  };

}


/* =========================================================
   UPLOAD BODY
========================================================= */

function uploadFileBody(
  sessionUrl,
  file,
  onProgress
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const xhr =
        new XMLHttpRequest();


      xhr.open(
        "PUT",
        sessionUrl
      );


      xhr.setRequestHeader(
        "Content-Type",
        file.type ||
          "application/octet-stream"
      );


      xhr.upload.onprogress =
        (
          event
        ) => {

          if (
            !event.lengthComputable ||
            !onProgress
          ) {
            return;
          }


          onProgress(

            Math.round(
              (
                event.loaded /
                event.total
              ) *
                100
            )

          );

        };


      xhr.onerror =
        () =>
          reject(
            new Error(
              `Upload ${file.name} terputus.`
            )
          );


      xhr.onload =
        () => {

          if (
            xhr.status < 200 ||
            xhr.status >= 300
          ) {

            reject(
              new Error(
                `Upload ${file.name} gagal (${xhr.status}).`
              )
            );

            return;
          }


          try {

            resolve(
              JSON.parse(
                xhr.responseText ||
                "{}"
              )
            );

          } catch {

            resolve({});

          }

        };


      xhr.send(
        file
      );

    }
  );

}


/* =========================================================
   UPLOAD PHOTO
========================================================= */

export async function uploadPhotoToFolder({
  file,
  folderId,
  token = accessToken,
  onProgress,
}) {

  const initiateResponse =
    await driveFetch(

      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,webContentLink",

      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json; charset=UTF-8",

          "X-Upload-Content-Type":
            file.type ||
            "application/octet-stream",

          "X-Upload-Content-Length":
            String(
              file.size
            ),

        },

        body:
          JSON.stringify({

            name:
              file.name,

            mimeType:
              file.type ||
              "application/octet-stream",

            parents: [
              folderId,
            ],

          }),

      },

      token

    );


  if (
    !initiateResponse.ok
  ) {

    throw new Error(
      `Gagal menyiapkan upload ${file.name} (${initiateResponse.status}).`
    );

  }


  const sessionUrl =
    initiateResponse.headers.get(
      "Location"
    );


  if (
    !sessionUrl
  ) {

    throw new Error(
      `Google Drive tidak memberikan upload session untuk ${file.name}.`
    );

  }


  const uploaded =
    await uploadFileBody(
      sessionUrl,
      file,
      onProgress
    );


  if (
    !uploaded?.id
  ) {

    throw new Error(
      `Google Drive tidak mengembalikan file ID untuk ${file.name}.`
    );

  }


  return uploaded;

}


/* =========================================================
   DELETE DRIVE ITEM
========================================================= */

export async function deleteDriveItem(
  fileId,
  token = accessToken
) {

  if (
    !fileId
  ) {
    return;
  }


  const response =
    await driveFetch(

      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}`,

      {

        method:
          "DELETE",

      },

      token

    );


  if (
    !response.ok &&
    response.status !== 404
  ) {

    throw new Error(
      `Gagal menghapus file Google Drive (${response.status}).`
    );

  }

}


/* =========================================================
   PUBLIC PHOTO URL
========================================================= */

export function driveThumbnailUrl(
  fileId,
  width = 1200
) {

  if (
    !fileId
  ) {
    return "";
  }


  return (
    `https://lh3.googleusercontent.com/d/` +
    `${encodeURIComponent(fileId)}` +
    `=w${width}`
  );

}


/* =========================================================
   PUBLIC DOWNLOAD URL
========================================================= */

export function driveDownloadUrl(
  fileId
) {

  if (
    !fileId
  ) {
    return "";
  }


  return (
    `https://drive.usercontent.google.com/download` +
    `?id=${encodeURIComponent(fileId)}` +
    `&export=download`
  );

}