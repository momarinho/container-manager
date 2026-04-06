import { useLocalSearchParams } from 'expo-router';
import ContainerDetailsScreen from '../../src/screens/containers/ContainerDetailsScreen';

export default function ContainerDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const containerId = Array.isArray(id) ? id[0] : id;

  return <ContainerDetailsScreen containerId={containerId ?? ''} />;
}
