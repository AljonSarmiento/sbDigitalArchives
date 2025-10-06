// --- CONFIGURATION ---
// SET YOUR ARCHIVES ROOT FOLDER ID HERE
const ROOT_FOLDER_ID = 'YOUR_ROOT_DRIVE_FOLDER_ID'; 

// SET A SECRET KEY FOR UPLOAD AUTHORIZATION
// Only users who know this key can upload files. Change this to a strong, secret value.
const UPLOAD_SECRET_KEY = 'YOUR_VERY_SECRET_KEY_123';
// ---------------------

/**
 * Handles GET requests from the frontend for listing and searching files.
 * @param {object} e - The request parameters object.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'list') {
    return handleListFiles(e.parameter);
  }

  return responseJSON({ error: 'Invalid action' }, 400);
}

/**
 * Handles POST requests from the frontend, primarily for file upload.
 * @param {object} e - The request parameters object containing file data.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) {
  // Check for the 'action' parameter from the query string (e.g., /?action=upload)
  const action = e.parameter.action;

  if (action === 'upload') {
    return handleUploadFile(e);
  }

  return responseJSON({ error: 'Invalid action' }, 400);
}

// ------------------- FILE LISTING & SEARCH HANDLER -------------------

/**
 * Searches and lists files based on criteria.
 * @param {object} params - Query parameters (search, year, type).
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function handleListFiles(params) {
  try {
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    
    // 1. Build the Search Query (Q-syntax)
    let query = `'${rootFolder.getId()}' in parents and trashed = false`;
    
    // Keyword/Name search
    if (params.search) {
      query += ` and fullText contains '${params.search.trim()}'`;
    }

    // MIME Type filtering (simplification for common types)
    if (params.type) {
      const typeMap = {
        'pdf': 'application/pdf',
        'word': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document or application/msword',
        'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet or application/vnd.ms-excel',
        'ppt': 'application/vnd.openxmlformats-officedocument.presentationml.presentation or application/vnd.ms-powerpoint'
      };
      const mimeQuery = typeMap[params.type.toLowerCase()];
      if (mimeQuery) {
        query += ` and (mimeType = '${mimeQuery.replace(/ or /g, "' or mimeType = '")}')`;
      }
    }
    
    // 2. Execute search
    const fileIterator = DriveApp.searchFiles(query);
    const allFiles = [];
    const yearFolders = {};
    const processedFiles = [];

    // Collect all files and folder structure
    while (fileIterator.hasNext()) {
      const file = fileIterator.next();
      
      // Get parent folder name to check for year-based sorting
      const parent = file.getParents().next();
      const parentName = parent.getName();
      
      // Check if file is in a year folder and matches the year filter
      const yearMatch = parentName.match(/^\d{4}$/); // Matches 4 digits (e.g., '2025')
      
      if (yearMatch) {
          yearFolders[parentName] = true; // Track available years
          
          if (params.year && params.year !== parentName) {
              continue; // Skip file if year filter is active and doesn't match
          }
      } else {
          // If no year filter is applied, we can still include files not in a year folder
          if (params.year) {
              continue; // Skip if year filter is active and the file isn't in a named year folder
          }
      }


      processedFiles.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        date: file.getDateCreated().getTime(),
        url: file.getUrl(), // Link to the Google Drive file viewer
        type: file.getMimeType().split('/').pop()
      });
    }

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
