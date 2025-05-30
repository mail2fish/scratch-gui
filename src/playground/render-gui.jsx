import React from 'react';
import ReactDOM from 'react-dom';
import {compose} from 'redux';

import AppStateHOC from '../lib/app-state-hoc.jsx';
import GUI from '../containers/gui.jsx';
import HashParserHOC from '../lib/hash-parser-hoc.jsx';
import log from '../lib/log.js';

const onClickLogo = () => {
    window.location = 'https://scratch.mit.edu';
};

const handleTelemetryModalCancel = () => {
    log('User canceled telemetry modal');
};

const handleTelemetryModalOptIn = () => {
    log('User opted into telemetry');
};

const handleTelemetryModalOptOut = () => {
    log('User opted out of telemetry');
};

// session reducer - 模拟 scratch-www 提供的
const sessionReducer = (state = {
    session: {
        user: {
            username: 'playgroundUser',
            token: 'mock-token',
            classroomId: '',
            thumbnailUrl: null
        }
    },
    permissions: {
        educator: false,
        student: false
    }
}, action) => {
    switch (action.type) {
        case 'SET_SESSION_USER':
            return {
                ...state,
                session: {
                    ...state.session,
                    user: {
                        ...state.session.user,
                        ...action.payload
                    }
                }
            };
        case 'SET_SESSION_PERMISSIONS':
            return {
                ...state,
                permissions: {
                    ...state.permissions,
                    ...action.payload
                }
            };
        default:
            return state;
    }
};

// 创建带 session 的 AppStateHOC
const AppStateHOCWithSession = (WrappedComponent) => {
    const AppStateWithSession = AppStateHOC(
        WrappedComponent,
        false, // 不是 localesOnly
        { session: sessionReducer }, // 额外的 reducers
        { session: undefined } // 额外的初始状态
    );
    
    // 简单包装，添加调试功能
    class SessionWrapper extends React.Component {
        componentDidMount() {
            // AppStateHOC 已经暴露了 store，直接添加调试功能
            setTimeout(() => {
                if (window._reduxStore) {
                    window.switchUser = (username) => {
                        window._reduxStore.dispatch({
                            type: 'SET_SESSION_USER',
                            payload: { username }
                        });
                    };
                    console.log('🎮 Playground session 已注入! 试试: window.switchUser("Alice")');
                }
            }, 100);
        }
        
        render() {
            return <AppStateWithSession {...this.props} />;
        }
    }
    
    return SessionWrapper;
};

/*
 * Render the GUI playground. This is a separate function because importing anything
 * that instantiates the VM causes unsupported browsers to crash
 * {object} appTarget - the DOM element to render to
 */
export default appTarget => {
    GUI.setAppElement(appTarget);

    // 使用带 session 的 AppStateHOC
    const WrappedGui = compose(
        AppStateHOCWithSession,
        HashParserHOC
    )(GUI);

    // TODO a hack for testing the backpack, allow backpack host to be set by url param
    const backpackHostMatches = window.location.href.match(/[?&]backpack_host=([^&]*)&?/);
    const backpackHost = backpackHostMatches ? backpackHostMatches[1] : null;

    const scratchDesktopMatches = window.location.href.match(/[?&]isScratchDesktop=([^&]+)/);
    let simulateScratchDesktop;
    if (scratchDesktopMatches) {
        try {
            // parse 'true' into `true`, 'false' into `false`, etc.
            simulateScratchDesktop = JSON.parse(scratchDesktopMatches[1]);
        } catch {
            // it's not JSON so just use the string
            // note that a typo like "falsy" will be treated as true
            simulateScratchDesktop = scratchDesktopMatches[1];
        }
    }

    if (process.env.NODE_ENV === 'production' && typeof window === 'object') {
        // Warn before navigating away
        window.onbeforeunload = () => true;
    }

    ReactDOM.render(
        <WrappedGui  
            canEditTitle
            backpackVisible
            backpackHost={backpackHost}
            canSave={true}
            onClickLogo={onClickLogo}
            assetHost="http://localhost:8080/assets/scratch"
        />,
        appTarget);
};
