import type { PageLoad } from './$types';
import {page} from "$app/state";

export const load: PageLoad = async ({ params, url, fetch }) => {
    const version = url.searchParams.get('version');
    const versionParam = version ? '?version=' + version : '';
    let serverData = await fetch(`/api/worlds/${params.id}${versionParam}`);
    return {
        serverData: await serverData.json(),
    };
};