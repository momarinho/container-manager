import { Tabs } from 'expo-router';
import { Database, Search, Terminal, Server } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.outline,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.surfaceHigh,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Database size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Search size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="terminal"
        options={{
          title: 'Terminal',
          tabBarIcon: ({ color }) => <Terminal size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="servers"
        options={{
          title: 'Servers',
          tabBarIcon: ({ color }) => <Server size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
