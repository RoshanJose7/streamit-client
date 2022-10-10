import { resolve } from "path";
import svgr from "vite-plugin-svgr";
import { Alias, defineConfig, loadEnv } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";

const tsconfig = {
  compilerOptions: {
    paths: {
      "@components/*": ["src/components/*"],
      "@pages/*": ["src/pages/*"],
      "@assets/*": ["src/assets/*"],
      "@utils/*": ["src/utils/*"],
    },
  },
};

function readAliasFromTsConfig(): Alias[] {
  const pathReplaceRegex = new RegExp(/\/\*$/, "");

  return Object.entries(tsconfig.compilerOptions.paths).reduce(
    (aliases, [fromPaths, toPaths]) => {
      const find = fromPaths.replace(pathReplaceRegex, "");
      const toPath = toPaths[0].replace(pathReplaceRegex, "");
      const replacement = resolve(__dirname, toPath);
      aliases.push({ find, replacement });
      return aliases;
    },
    [] as Alias[]
  );
}

export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  return defineConfig({
    base: "/",
    plugins: [reactRefresh(), svgr()],
    resolve: {
      alias: readAliasFromTsConfig(),
    },
  });
};
