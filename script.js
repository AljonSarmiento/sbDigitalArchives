// script.js
const apiUrl = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');
const searchInput = document.getElementById('search');
const loginBtn = document.getElementById('login-btn');

uploadBtn.addEventListener('click', () => {
  const file = fileInput.files[0];
  const fileName = file.name;
  const mimeType = file.type;
  const reader = new FileReader();
  reader.onload = () => {
    const fileData = reader.result;
    fetch(apiUrl + '?func=uploadFile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file: fileData,
        fileName: fileName,
        mimeType: mimeType
      })
    })
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error(error));
  };
  reader.readAsArrayBuffer(file);
});

searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  fetch(apiUrl + '?func=searchFiles&query=' + query)
  .then(response => response.json())
  .then(data => {
    fileList.innerHTML = '';
    data.forEach(file => {
      const fileCard = document.createElement('div');
      fileCard.classList.add('file-card');
      fileCard.innerHTML = `
        <h2>${file.name}</h2>
        <p>Uploaded on ${file.date}</p>
        <p>Type: ${file.type}</p>
        <a href="https:                                                                 
        <a href="https:                                                                      
      `//drive.google.com/uc?id=${file.id}&export=download">Download</a>
        <a href="https://drive.google.com/file/d/${file.id}/view" target="_blank">Preview</a>
      `;
      fileList.appendChild(fileCard);
    });
  })
  .catch(error => console.error(error));
});

loginBtn.addEventListener('click', () => {
  // Implement Google Sign-In or simple login functionality
});

fetch(apiUrl + '?func=getFiles')
.then(response => response.json())
.then(data => {
  data.forEach(file => {
    const fileCard = document.createElement('div');
    fileCard.classList.add('file-card');
    fileCard.innerHTML = `
      <h2>${file.name}</h2>
      <p>Uploaded on ${file.date}</p>
      <p>Type: ${file.type}</p>
      <a href="https:                                                                 
      <a href="https:                                                                      
    `//drive.google.com/uc?id=${file.id}&export=download">Download</a>
      <a href="https://drive.google.com/file/d/${file.id}/view" target="_blank">Preview</a>
    `;
    fileList.appendChild(fileCard);
  });
})
.catch(error => console.error(error));
