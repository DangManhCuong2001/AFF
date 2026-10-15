pipeline {
    agent any

    tools {
        nodejs 'node22'
    }

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Environment') {
            steps {
                sh 'node -v'
                sh 'corepack pnpm -v'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'corepack pnpm install --frozen-lockfile'
            }
        }

        stage('Type Check') {
            steps {
                sh 'corepack pnpm typecheck'
            }
        }

        stage('Build Next.js') {
            steps {
                sh 'corepack pnpm build'
            }
        }
    }

    post {
        success {
            echo 'VIPEE CI SUCCESS!'
        }

        failure {
            echo 'VIPEE CI FAILED!'
        }
    }
}
