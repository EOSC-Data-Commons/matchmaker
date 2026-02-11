import {type RouteConfig, index, route} from "@react-router/dev/routes";

export default [
    index("pages/LandingPage.tsx"),
    route("search", "pages/SearchPage.tsx"),
    route("dispatcher/run", "pages/DispatcherRunPage.tsx"),
    route("*", "pages/NotFound.tsx"),
] satisfies RouteConfig;

