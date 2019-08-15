const Amplify = require('aws-amplify').default;
const jwtDecode = require('jwt-decode');
const { Auth } = Amplify;

module.exports = async function (context) {
  const validToken = token => {
    if(typeof token == 'undefined' || token == null) {
      return false;
    }

    const now = Date.now().valueOf() / 1000;
    const data = jwtDecode(token);
    if (typeof data.exp !== 'undefined' && data.exp < now) {
      return false
    }

    return !(typeof data.nbf !== 'undefined' && data.nbf > now);
  };

  const username = context.request.getEnvironmentVariable('username');
  const password = context.request.getEnvironmentVariable('password');
  const userPoolId = context.request.getEnvironmentVariable('userPoolId');
  const clientId = context.request.getEnvironmentVariable('clientId');

  const existingAccessToken = await context.store.getItem("accessToken");
  const existingIdToken = await context.store.getItem("idToken");

  if(!validToken(existingAccessToken)) {
    const cognitoUserConfig = {
      username: username,
      password: password,
      userPoolId: userPoolId,
      clientId: clientId
    };

    Amplify.configure({
      Auth: {
        region: 'eu-central-1',
        userPoolId: cognitoUserConfig.userPoolId,
        userPoolWebClientId: cognitoUserConfig.clientId,
        mandatorySignIn: false
      }
    });

    const tokens = await Auth.signIn(cognitoUserConfig.username, cognitoUserConfig.password).then(user => {
      const accessToken = user.signInUserSession.accessToken.jwtToken;
      const idToken = user.signInUserSession.idToken.jwtToken;
      context.store.setItem("accessToken", accessToken);
      context.store.setItem("idToken", accessToken);
      return  {
        accessToken : accessToken,
        idToken : idToken
      };
    }).catch(err => console.log(err));
    console.log("using NEW tokens");
    context.request.setHeader('Authorization', `Bearer ${tokens.accessToken}`);
    context.request.setHeader('Identity', `${tokens.idToken}`);
  } else {
    console.log("using EXISTING tokens");
    context.request.setHeader('Authorization', `Bearer ${existingAccessToken}`);
    context.request.setHeader('Identity', `${existingIdToken}`);
  }
};
