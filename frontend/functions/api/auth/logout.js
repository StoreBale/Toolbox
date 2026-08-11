import { logout } from '../../../server/auth.js';

export const onRequestPost = ({ request, env }) => logout(request, env);
