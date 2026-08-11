import { login } from '../../../server/auth.js';

export const onRequestPost = ({ request, env }) => login(request, env);
