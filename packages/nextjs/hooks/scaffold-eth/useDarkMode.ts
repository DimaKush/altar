import { useTheme } from "next-themes";

export const useDarkMode = () => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  return { isDarkMode };
}; 