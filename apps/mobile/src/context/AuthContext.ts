import { createContext } from 'react';

export const AuthContext = createContext<{ signIn: () => void }>({
  signIn: () => {},
});
