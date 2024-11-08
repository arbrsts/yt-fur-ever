interface ElectronQueryArgs {
  url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: any[];
}

type ElectronBaseQuery = () => (args: ElectronQueryArgs) => Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { data: any; error?: undefined }
  | { error: { status: string; error: string }; data?: undefined }
>;

// Create a properly typed base query
export const electronBaseQuery: ElectronBaseQuery =
  () => async (args: ElectronQueryArgs) => {
    try {
      const result = await window.electron.invoke(
        args.url,
        ...(args.args || [])
      );
      return { data: result };
    } catch (error) {
      return {
        error: {
          status: "CUSTOM_ERROR",
          error: error instanceof Error ? error.message : "An error occurred",
        },
      };
    }
  };
