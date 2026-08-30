import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserAttribute,
  type ICognitoUserData,
} from "amazon-cognito-identity-js";

export type AuthMode = "mock" | "cognito";

export type AuthenticatedUser = {
  email: string;
  accessToken?: string;
  idToken?: string;
};

export type NewPasswordChallenge = {
  cognitoUser: CognitoUser;
  userAttributes: Record<string, string>;
};

export type SignInResult =
  | { status: "authenticated"; user: AuthenticatedUser }
  | { status: "new-password-required"; challenge: NewPasswordChallenge };

const mode = (import.meta.env.VITE_AUTH_MODE ?? "mock") as AuthMode;

const requiredCognitoConfig = () => {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim();
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();

  if (!userPoolId || !clientId) {
    throw new Error(
      "Configure VITE_COGNITO_USER_POOL_ID e VITE_COGNITO_CLIENT_ID.",
    );
  }

  return { userPoolId, clientId };
};

const createCognitoUser = (email: string) => {
  const { userPoolId, clientId } = requiredCognitoConfig();
  const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
  const userData: ICognitoUserData = { Username: email, Pool: pool };
  return new CognitoUser(userData);
};

const delay = (duration: number) =>
  new Promise((resolve) => window.setTimeout(resolve, duration));

export const authMode = mode;

export const signIn = async (email: string, password: string): Promise<SignInResult> => {
  if (mode === "mock") {
    await delay(650);
    return { status: "authenticated", user: { email } };
  }

  const cognitoUser = createCognitoUser(email);
  const details = new AuthenticationDetails({ Username: email, Password: password });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(details, {
      onSuccess: (session) => {
        resolve({
          status: "authenticated",
          user: {
            email,
            accessToken: session.getAccessToken().getJwtToken(),
            idToken: session.getIdToken().getJwtToken(),
          },
        });
      },
      onFailure: (error) => reject(error),
      newPasswordRequired: (userAttributes) => {
        const attributes = { ...userAttributes } as Record<string, string>;
        delete attributes.email_verified;
        resolve({
          status: "new-password-required",
          challenge: { cognitoUser, userAttributes: attributes },
        });
      },
    });
  });
};

export const completeNewPassword = async (
  challenge: NewPasswordChallenge,
  password: string,
): Promise<AuthenticatedUser> =>
  new Promise((resolve, reject) => {
    challenge.cognitoUser.completeNewPasswordChallenge(
      password,
      challenge.userAttributes,
      {
        onSuccess: (session) => {
          resolve({
            email: challenge.cognitoUser.getUsername(),
            accessToken: session.getAccessToken().getJwtToken(),
            idToken: session.getIdToken().getJwtToken(),
          });
        },
        onFailure: (error) => reject(error),
      },
    );
  });

export const requestPasswordReset = async (email: string): Promise<void> => {
  if (mode === "mock") {
    await delay(500);
    return;
  }

  const cognitoUser = createCognitoUser(email);
  return new Promise((resolve, reject) => {
    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (error) => reject(error),
    });
  });
};

export const confirmPasswordReset = async (
  email: string,
  code: string,
  password: string,
): Promise<void> => {
  if (mode === "mock") {
    await delay(500);
    return;
  }

  const cognitoUser = createCognitoUser(email);
  return new Promise((resolve, reject) => {
    cognitoUser.confirmPassword(code, password, {
      onSuccess: () => resolve(),
      onFailure: (error) => reject(error),
    });
  });
};

export type { CognitoUserAttribute };

