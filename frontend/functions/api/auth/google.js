import { googleLogin } from '../../../server/auth.js';

export const onRequestPost = ({ request, env }) => googleLogin(request, env);
