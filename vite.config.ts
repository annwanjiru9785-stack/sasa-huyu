import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [
        react({
            babel: {
                presets: [
                    ['@babel/preset-env', { targets: { browsers: ['last 2 versions'] } }],
                    ['@babel/preset-react', { runtime: 'automatic' }],
                    '@babel/preset-typescript',
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            react: path.resolve('./node_modules/react'),
            'react-dom': path.resolve('./node_modules/react-dom'),
            './components/AppLayout/Submenu /index.js': path.resolve(
                __dirname,
                './src/components/shims/ui-submenu/index.js'
            ),
            '../Submenu /index.js': path.resolve(__dirname, './src/components/shims/ui-submenu/index.js'),
            '@deriv/quill-icons/Legacy': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Legacy'
            ),
            '@deriv/quill-icons/LabelPaired': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/LabelPaired'
            ),
            '@deriv/quill-icons/Standalone': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Standalone'
            ),
            '@deriv/quill-icons/Flags': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Flags'
            ),
            '@deriv/quill-icons/Illustration': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Illustration'
            ),
            '@deriv/quill-icons/Logo': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Logo'
            ),
            '@deriv/quill-icons/Currencies': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Currencies'
            ),
            '@deriv/quill-icons/Accounts': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Accounts'
            ),
            '@deriv/quill-icons/Markets': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Markets'
            ),
            '@deriv/quill-icons/Social': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Social'
            ),
            '@deriv/quill-icons/PaymentMethods': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/PaymentMethods'
            ),
            '@deriv/quill-icons/Illustrative': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/Illustrative'
            ),
            '@deriv/quill-icons/TradeTypes': path.resolve(
                __dirname,
                'node_modules/@deriv/quill-icons/dist/react/TradeTypes'
            ),
            '@rudderstack/analytics-js': path.resolve(
                __dirname,
                'node_modules/@rudderstack/analytics-js/dist/npm/modern/cjs/index.cjs'
            ),
            'object.fromentries': path.resolve(
                __dirname,
                'src/components/shims/object-fromentries/index.js'
            ),
            '@/external': path.resolve(__dirname, './src/external'),
            '@/components': path.resolve(__dirname, './src/components'),
            '@/hooks': path.resolve(__dirname, './src/hooks'),
            '@/utils': path.resolve(__dirname, './src/utils'),
            '@/constants': path.resolve(__dirname, './src/constants'),
            '@/stores': path.resolve(__dirname, './src/stores'),
            '@/types': path.resolve(__dirname, './src/types'),
            '@/pages': path.resolve(__dirname, './src/pages'),
            '@/app': path.resolve(__dirname, './src/app'),
            '@/auth': path.resolve(__dirname, './src/auth'),
            '@/analytics': path.resolve(__dirname, './src/analytics'),
            '@/styles': path.resolve(__dirname, './src/styles'),
            '@/workers': path.resolve(__dirname, './src/workers'),
            '@/xml': path.resolve(__dirname, './src/xml'),
        },
    },
    define: {
        'process.env': {
            NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
            TRANSLATIONS_CDN_URL: JSON.stringify(process.env.TRANSLATIONS_CDN_URL),
            R2_PROJECT_NAME: JSON.stringify(process.env.R2_PROJECT_NAME),
            CROWDIN_BRANCH_NAME: JSON.stringify(process.env.CROWDIN_BRANCH_NAME),
            TRACKJS_TOKEN: JSON.stringify(process.env.TRACKJS_TOKEN),
            APP_ENV: JSON.stringify(process.env.APP_ENV),
            REF_NAME: JSON.stringify(process.env.REF_NAME),
            REMOTE_CONFIG_URL: JSON.stringify(process.env.REMOTE_CONFIG_URL),
            GD_CLIENT_ID: JSON.stringify(process.env.GD_CLIENT_ID),
            GD_APP_ID: JSON.stringify(process.env.GD_APP_ID),
            GD_API_KEY: JSON.stringify(process.env.GD_API_KEY),
            DATADOG_SESSION_REPLAY_SAMPLE_RATE: JSON.stringify(process.env.DATADOG_SESSION_REPLAY_SAMPLE_RATE),
            DATADOG_SESSION_SAMPLE_RATE: JSON.stringify(process.env.DATADOG_SESSION_SAMPLE_RATE),
            DATADOG_APPLICATION_ID: JSON.stringify(process.env.DATADOG_APPLICATION_ID),
            DATADOG_CLIENT_TOKEN: JSON.stringify(process.env.DATADOG_CLIENT_TOKEN),
            RUDDERSTACK_KEY: JSON.stringify(process.env.RUDDERSTACK_KEY),
            GROWTHBOOK_CLIENT_KEY: JSON.stringify(process.env.GROWTHBOOK_CLIENT_KEY),
            GROWTHBOOK_DECRYPTION_KEY: JSON.stringify(process.env.GROWTHBOOK_DECRYPTION_KEY),
        },
        'process.platform': JSON.stringify('browser'),
        'process.versions': JSON.stringify({}),
    },
    css: {
        preprocessorOptions: {
            scss: {
                sourceMap: true,
            },
        },
    },
    server: {
        port: 5000,
        host: '0.0.0.0',
        allowedHosts: true,
        historyApiFallback: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
    assetsInclude: ['**/*.xml'],
    optimizeDeps: {
        include: ['react', 'react-dom', 'mobx', 'mobx-react-lite'],
        esbuildOptions: {
            target: 'es2020',
            loader: {
                '.js': 'jsx',
            },
        },
    },
});

