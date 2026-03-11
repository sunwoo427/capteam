import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import WorkspaceSelectScreen from './screens/WorkspaceSelectScreen';
import CreateWorkspaceScreen from './screens/CreateWorkspaceScreen';
import JoinWorkspaceScreen from './screens/JoinWorkspaceScreen';
import DashboardScreen from './screens/DashboardScreen';
import WorkspaceChatScreen from './screens/WorkspaceChatScreen';
import FindIdScreen from './screens/FindIdScreen';
import FindPasswordScreen from './screens/FindPasswordScreen';
import { StatusBar } from 'expo-status-bar';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  FindId: undefined;
  FindPassword: undefined;
  WorkspaceSelect: { userId: string };
  CreateWorkspace: { userId: string };
  JoinWorkspace: { userId: string };
  Dashboard: { workspaceId: string; workspaceName: string; userId: string };
  Chat: { workspaceId: string; workspaceName: string; userId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0f172a' }
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="FindId" component={FindIdScreen} />
          <Stack.Screen name="FindPassword" component={FindPasswordScreen} />
          <Stack.Screen name="WorkspaceSelect" component={WorkspaceSelectScreen} />
          <Stack.Screen name="CreateWorkspace" component={CreateWorkspaceScreen} />
          <Stack.Screen name="JoinWorkspace" component={JoinWorkspaceScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Chat" component={WorkspaceChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
