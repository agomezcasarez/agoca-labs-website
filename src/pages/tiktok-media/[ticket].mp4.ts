import type { APIRoute } from 'astro';
import { serveTikTokMedia } from '../../lib/tiktok-media';

export const prerender = false;
export const ALL: APIRoute = ({request,params}) => serveTikTokMedia(request,params.ticket);
