// Code.gs
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function uploadFile(file, fileName, mimeType) {
  var folder = getFolder();
  var file = folder.createFile(file);
  file.setName(fileName);
  return file.getId();
}

function getFiles() {
  var folder = getFolder();
  var files = folder.getFiles();
  var fileList = [];
  while (files.hasNext()) {
    var file = files.next();
    fileList.push({
      id: file.getId(),
      name: file.getName(),
      date: file.getLastUpdated(),
      type: file.getMimeType()
    });
  }
  return fileList;
}

function getFolder() {
  var folders = DriveApp.getFoldersByName('Digital Archives');
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder('Digital Archives');
  }
  var year = new Date().getFullYear().toString();
  var yearFolder = folder.getFoldersByName(year);
  if (yearFolder.hasNext()) {
    return yearFolder.next();
  } else {
    return folder.createFolder(year);
  }
}

function searchFiles(query) {
  var folder = getFolder();
  var files = folder.getFiles();
  var results = [];
  while (files.hasNext()) {
    var file = files.next();
    if (file.getName().includes(query) || file.getDescription().includes(query)) {
      results.push({
        id: file.getId(),
        name: file.getName(),
        date: file.getLastUpdated(),
        type: file.getMimeType()
      });
    }
  }
  return results;
}    }

    // 3. Prepare response
    const availableYears = Object.keys(yearFolders).sort().reverse();

    return responseJSON({
      files: processedFiles.slice(0, 100), // Limit to 100 for performance
      availableYears: availableYears
    });

  } catch (e) {
    Logger.log(e);
    return responseJSON({ error: `Server error during list: ${e.message}` }, 500);
  }
}

// ------------------- FILE UPLOAD HANDLER -------------------

/**
 * Handles the file upload and folder organization.
 * @param {object} e - The POST request parameters.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function handleUploadFile(e) {
  // 1. Authorization Check
  // Note: For POST requests from a GitHub Pages frontend, the parameters are in e.postData.contents
  // We rely on the client-side FormData sending 'secret'
  const secret = e.parameters.secret ? e.parameters.secret[0] : null;

  if (secret !== UPLOAD_SECRET_KEY) {
    return responseJSON({ error: 'Unauthorized. Invalid upload secret key.' }, 401);
  }
  
  const blob = e.postData.getBlob(); // Get the file blob

  if (!blob) {
    return responseJSON({ error: 'No file found in the request.' }, 400);
  }

  try {
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const currentYear = new Date().getFullYear().toString();

    // 2. Check/Create Year Folder (e.g., "2025")
    let yearFolder;
    try {
      // Search for the folder in the root
      const folderIterator = rootFolder.getFoldersByName(currentYear);
      if (folderIterator.hasNext()) {
        yearFolder = folderIterator.next();
      } else {
        // Create folder if it doesn't exist
        yearFolder = rootFolder.createFolder(currentYear);
      }
    } catch (err) {
      Logger.log(`Error getting/creating year folder: ${err}`);
      // Fallback: upload to root if folder operation fails
      yearFolder = rootFolder;
    }

    // 3. Upload File
    const file = yearFolder.createFile(blob);
    
    // Set sharing to anyone with the link can view (important for public preview)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return responseJSON({
      success: true,
      name: file.getName(),
      id: file.getId(),
      url: file.getUrl()
    });

  } catch (err) {
    Logger.log(`Upload error: ${err}`);
    return responseJSON({ error: `Server error during upload: ${err.message}` }, 500);
  }
}

// ------------------- UTILITY FUNCTIONS -------------------

/**
 * Creates a JSON response for the Web App.
 * @param {object} data - The object to serialize as JSON.
 * @param {number} statusCode - The HTTP status code (default 200).
 * @returns {GoogleAppsScript.Content.TextOutput} The response object.
 */
function responseJSON(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // CORS Headers for GitHub Pages interaction
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Note: ContentService doesn't allow setting the HTTP status code directly in the output object
  // For proper error handling, a separate library or advanced service is typically needed.
  // We rely on the response JSON structure to signal success/failure.
  return output;
}
