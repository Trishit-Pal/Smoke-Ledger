// Plain (non-'use server') module for the login form's action state.
//
// This MUST NOT carry the 'use server' directive: a 'use server' file may only
// export async functions, so the state type + initial value live here instead of
// in ./actions.ts. See https://nextjs.org/docs/messages/invalid-use-server-value

export type LoginActionState = {
  code: string | null;
  message: string | null;
};

export const initialLoginActionState: LoginActionState = { code: null, message: null };
