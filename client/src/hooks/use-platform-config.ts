import { useQuery } from "@tanstack/react-query";

export type PlatformConfig = {
  applicationName: string;
  supportEmail: string;
  registrationEnabled: boolean;
};

const defaults: PlatformConfig = {
  applicationName: "FinTrack",
  supportEmail: "",
  registrationEnabled: true,
};

export function usePlatformConfig() {
  const query = useQuery({
    queryKey: ["/api/platform-config"],
    queryFn: async (): Promise<PlatformConfig> => {
      const response = await fetch("/api/platform-config");
      if (!response.ok) throw new Error("Platform configuration could not be loaded.");
      return response.json();
    },
    staleTime: 60_000,
    retry: false,
  });
  return { ...query, config: query.data || defaults };
}
