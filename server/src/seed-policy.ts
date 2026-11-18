const allowedSeedEnvironments = new Set(["development", "test"]);

export function assertSeedEnvironment(nodeEnv: string | undefined) {
  if (!nodeEnv || !allowedSeedEnvironments.has(nodeEnv)) {
    throw new Error("Synthetic seed is allowed only when NODE_ENV is exactly development or test");
  }
}
