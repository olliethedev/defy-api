export default (request, response, next) => {
  let log = `=============${new Date()}=============\n`;
  log += `${request.method} ${request.path}\n`;
  if (Object.keys(request.query).length) {
    log += `Query:\n${JSON.stringify(request.query)}\n`;
  }
  if (Object.keys(request.body).length) {
    log += `Body:\n${JSON.stringify(request.body)}\n`;
  }
  log +=
    "================================================================================";
  console.log(log);
  next();
};

export const logInvoice = (invoice, status) => {
  let log = `=============${new Date()}=============\n`;
  log += `=============${status}=============\n`;
  log += `${JSON.stringify(invoice)}\n`;
  log +=
    "================================================================================";
  console.log(log);
};
