export const readAsDataURL = (inputFile) =>
  new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("load", (e) => resolve(e.target.result));
    fileReader.addEventListener("error", reject);
    fileReader.readAsDataURL(inputFile);
  });
