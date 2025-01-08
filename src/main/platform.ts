export const getUploadOnceAvailable = () => {
  switch (process.platform) {
    case "aix":
    case "android":
    case "freebsd":
    case "haiku":
    case "linux":
    case "openbsd":
    case "sunos":
    case "win32":
    case "cygwin":
    case "netbsd": {
      return true;
    }

    case "darwin": {
      return false;
    }

    default: {
      throw new Error(`Unknown platform: ${process.platform satisfies never}`);
    }
  }
};
