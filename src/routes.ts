import {type RouteConfig, index, route} from "@react-router/dev/routes";

export default [
    index("pages/LandingPage.tsx"),
    route("search", "pages/SearchPage.tsx"),
    route("chat/:id?", "pages/ChatPage.tsx"),
    route("dispatcher/run", "pages/DispatcherRunPage.tsx"),
    route("*", "pages/NotFound.tsx"),
] satisfies RouteConfig;
