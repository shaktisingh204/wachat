'use server';

export async function executeWeChatAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.weixin.qq.com/cgi-bin';

        const getAccessTokenFromApi = async (): Promise<string> => {
            const res = await fetch(
                `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${inputs.appId}&secret=${inputs.appSecret}`
            );
            const data = await res.json();
            if (data.errcode) {
                throw new Error(`WeChat access token error: ${data.errmsg}`);
            }
            return data.access_token;
        };

        const resolveToken = async (): Promise<string> => {
            if (inputs.accessToken) return inputs.accessToken;
            return getAccessTokenFromApi();
        };

        const post = async (path: string, body: any) => {
            const token = await resolveToken();
            return fetch(`${baseUrl}${path}?access_token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(r => r.json());
        };

        const get = async (path: string, extraParams: string = '') => {
            const token = await resolveToken();
            return fetch(`${baseUrl}${path}?access_token=${token}${extraParams}`).then(r => r.json());
        };

        switch (actionName) {
            case 'getAccessToken': {
                const res = await fetch(
                    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${inputs.appId}&secret=${inputs.appSecret}`
                );
                const data = await res.json();
                return { output: data };
            }

            case 'sendTemplateMessage': {
                const data = await post('/message/template/send', {
                    touser: inputs.toUser,
                    template_id: inputs.templateId,
                    url: inputs.url,
                    miniprogram: inputs.miniprogram,
                    data: inputs.data || {},
                });
                return { output: data };
            }

            case 'sendCustomMessage': {
                const data = await post('/message/custom/send', {
                    touser: inputs.toUser,
                    msgtype: inputs.msgType || 'text',
                    text: inputs.text ? { content: inputs.text } : undefined,
                    image: inputs.imageMediaId ? { media_id: inputs.imageMediaId } : undefined,
                    voice: inputs.voiceMediaId ? { media_id: inputs.voiceMediaId } : undefined,
                    video: inputs.video,
                    music: inputs.music,
                    news: inputs.news,
                });
                return { output: data };
            }

            case 'listMenus': {
                const data = await get('/menu/get');
                return { output: data };
            }

            case 'createMenu': {
                const data = await post('/menu/create', {
                    button: inputs.button || [],
                });
                return { output: data };
            }

            case 'deleteMenu': {
                const data = await get('/menu/delete');
                return { output: data };
            }

            case 'listUsers': {
                const nextOpenid = inputs.nextOpenid ? `&next_openid=${inputs.nextOpenid}` : '';
                const data = await get('/user/get', nextOpenid);
                return { output: data };
            }

            case 'getUser': {
                const data = await get('/user/info', `&openid=${inputs.openid}&lang=${inputs.lang || 'zh_CN'}`);
                return { output: data };
            }

            case 'sendMassMessage': {
                const data = await post('/message/mass/sendall', {
                    filter: inputs.filter || { is_to_all: inputs.isToAll !== false },
                    msgtype: inputs.msgType || 'text',
                    text: inputs.text ? { content: inputs.text } : undefined,
                    image: inputs.imageMediaId ? { media_id: inputs.imageMediaId } : undefined,
                    voice: inputs.voiceMediaId ? { media_id: inputs.voiceMediaId } : undefined,
                    mpnews: inputs.mpnews,
                    mpvideo: inputs.mpvideo,
                });
                return { output: data };
            }

            case 'getMediaUrl': {
                const token = await resolveToken();
                const data = await fetch(`${baseUrl}/media/get?access_token=${token}&media_id=${inputs.mediaId}`).then(r => r.json());
                return { output: data };
            }

            case 'uploadMedia': {
                const token = await resolveToken();
                const formData = new FormData();
                if (inputs.fileUrl) {
                    const fileRes = await fetch(inputs.fileUrl);
                    const blob = await fileRes.blob();
                    formData.append('media', blob, inputs.filename || 'media');
                }
                const uploadRes = await fetch(
                    `${baseUrl}/media/upload?access_token=${token}&type=${inputs.mediaType || 'image'}`,
                    { method: 'POST', body: formData }
                );
                const data = await uploadRes.json();
                return { output: data };
            }

            case 'listArticles': {
                const data = await post('/material/batchget_material', {
                    type: 'news',
                    offset: inputs.offset || 0,
                    count: inputs.count || 20,
                });
                return { output: data };
            }

            case 'createArticle': {
                const data = await post('/material/add_news', {
                    articles: inputs.articles || [],
                });
                return { output: data };
            }

            case 'getWebPageAccessToken': {
                const res = await fetch(
                    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${inputs.appId}&secret=${inputs.appSecret}&code=${inputs.code}&grant_type=authorization_code`
                );
                const data = await res.json();
                return { output: data };
            }

            case 'generateQRCode': {
                const data = await post('/qrcode/create', {
                    expire_seconds: inputs.expireSeconds || 604800,
                    action_name: inputs.actionName || 'QR_SCENE',
                    action_info: {
                        scene: {
                            scene_id: inputs.sceneId,
                            scene_str: inputs.sceneStr,
                        },
                    },
                });
                return { output: data };
            }

            default:
                return { error: `WeChat action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        return { error: err.message || 'WeChat action failed with an unknown error.' };
    }
}
