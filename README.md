# SimpleUserAPI
APIs in NodeJs for User registration and authentication.

## Requirements

  + NodeJs -
  + config.js - File with same structure as below

  ```javascript
  module.exports = {
      'secret': 'abcdefg',    //Secret Key for jsonwebtoken generation
      'orcestrateApiKey':'xyz', //DB as Service API key
      'orchestrateLocation':'example.xay.cok', //Location of Database
      'sendgridUser':'sendgrid_user', //SendGrid username(username===apikey)
      'sendgridApi':'sendgrid_password' //SendGrid Password
  };
  ```

## Initial Steps

  Execute the following commands:

    1 `npm install`
    2 `node index.js`
  
