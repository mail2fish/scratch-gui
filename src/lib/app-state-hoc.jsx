import React from 'react';
import PropTypes from 'prop-types';
import {Provider} from 'react-redux';
import {createStore, combineReducers, compose} from 'redux';
import ConnectedIntlProvider from './connected-intl-provider.jsx';

import localesReducer, {initLocale, localesInitialState} from '../reducers/locales';

import {setPlayer, setFullScreen} from '../reducers/mode.js';

import locales from 'scratch-l10n';
import {detectLocale} from './detect-locale';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

/*
 * Higher Order Component to provide redux state. If an `intl` prop is provided
 * it will override the internal `intl` redux state
 * @param {React.Component} WrappedComponent - component to provide state for
 * @param {boolean} localesOnly - only provide the locale state, not everything
 *                      required by the GUI. Used to exclude excess state when
                        only rendering modals, not the GUI.
 * @param {object} extraReducers - additional reducers to inject (e.g. session)
 * @param {object} extraInitialState - additional initial state for extra reducers
 * @returns {React.Component} component with redux and intl state provided
 */
const AppStateHOC = function (WrappedComponent, localesOnly, extraReducers = {}, extraInitialState = {}) {
    class AppStateWrapper extends React.Component {
        constructor (props) {
            super(props);
            let initialState = {};
            let reducers = {};
            let enhancer;

            let initializedLocales = localesInitialState;
            const locale = detectLocale(Object.keys(locales));
            if (locale !== 'en') {
                initializedLocales = initLocale(initializedLocales, locale);
            }
            if (localesOnly) {
                // Used for instantiating minimal state for the unsupported
                // browser modal
                reducers = {
                    locales: localesReducer,
                    ...extraReducers // 合并额外的 reducers
                };
                initialState = {
                    locales: initializedLocales,
                    ...extraInitialState // 合并额外的初始状态
                };
                enhancer = composeEnhancers();
            } else {
                // You are right, this is gross. But it's necessary to avoid
                // importing unneeded code that will crash unsupported browsers.
                const guiRedux = require('../reducers/gui');
                const guiReducer = guiRedux.default;
                const {
                    guiInitialState,
                    guiMiddleware,
                    initFullScreen,
                    initPlayer,
                    initTelemetryModal
                } = guiRedux;
                const {ScratchPaintReducer} = require('scratch-paint');

                let initializedGui = guiInitialState;
                if (props.isFullScreen || props.isPlayerOnly) {
                    if (props.isFullScreen) {
                        initializedGui = initFullScreen(initializedGui);
                    }
                    if (props.isPlayerOnly) {
                        initializedGui = initPlayer(initializedGui);
                    }
                } else if (props.showTelemetryModal) {
                    initializedGui = initTelemetryModal(initializedGui);
                }
                reducers = {
                    locales: localesReducer,
                    scratchGui: guiReducer,
                    scratchPaint: ScratchPaintReducer,
                    ...extraReducers // 合并额外的 reducers
                };
                initialState = {
                    locales: initializedLocales,
                    scratchGui: initializedGui,
                    ...extraInitialState // 合并额外的初始状态
                };
                enhancer = composeEnhancers(guiMiddleware);
            }
            const reducer = combineReducers(reducers);
            this.store = createStore(
                reducer,
                initialState,
                enhancer
            );
            
            // 如果有额外的 reducers，说明是特殊用途（如 playground），暴露 store 到全局
            if (Object.keys(extraReducers).length > 0) {
                window._reduxStore = this.store;
                console.log('🔧 AppStateHOC store 已暴露到 window._reduxStore');
            }
        }
        componentDidUpdate (prevProps) {
            if (localesOnly) return;
            if (prevProps.isPlayerOnly !== this.props.isPlayerOnly) {
                this.store.dispatch(setPlayer(this.props.isPlayerOnly));
            }
            if (prevProps.isFullScreen !== this.props.isFullScreen) {
                this.store.dispatch(setFullScreen(this.props.isFullScreen));
            }
        }
        render () {
            const {
                isFullScreen, // eslint-disable-line no-unused-vars
                isPlayerOnly, // eslint-disable-line no-unused-vars
                showTelemetryModal, // eslint-disable-line no-unused-vars
                ...componentProps
            } = this.props;
            return (
                <Provider store={this.store}>
                    <ConnectedIntlProvider>
                        <WrappedComponent
                            {...componentProps}
                        />
                    </ConnectedIntlProvider>
                </Provider>
            );
        }
    }
    AppStateWrapper.propTypes = {
        isFullScreen: PropTypes.bool,
        isPlayerOnly: PropTypes.bool,
        isTelemetryEnabled: PropTypes.bool,
        showTelemetryModal: PropTypes.bool
    };
    return AppStateWrapper;
};

export default AppStateHOC;
