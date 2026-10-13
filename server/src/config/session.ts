// A signed-in session lasts one day. The JWT lifetime and the auth cookie share this value so
// they cannot drift apart. It is deliberately not read from the environment.
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
