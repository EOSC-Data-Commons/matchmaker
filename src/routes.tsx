import type {RouteObject} from "react-router-dom";
import {LandingPage} from "./pages/LandingPage";
import {SearchPage} from "./pages/SearchPage";
import {DispatcherRunPage} from "./pages/DispatcherRunPage";
import NotFound from "./pages/NotFound";
import {ErrorBoundary} from "./components/ErrorBoundary";
import MatomoTracker from "./components/MatomoTracker";
import React from "react";

// Root layout wrapper
function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <>
            <MatomoTracker/>
            <ErrorBoundary>
                {children}
            </ErrorBoundary>
        </>
    );
}


export const routes: RouteObject[] = [
    {
        path: "/",
        element: <RootLayout><LandingPage/></RootLayout>,
    },
    {
        path: "/search",
        element: <RootLayout><SearchPage/></RootLayout>,
    },
    {
        path: "/dispatcher/run",
        element: <RootLayout><DispatcherRunPage/></RootLayout>,
    },
    {
        path: "*",
        element: <RootLayout><NotFound/></RootLayout>,
    },
];

