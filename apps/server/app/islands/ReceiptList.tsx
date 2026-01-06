import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Pagination,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { InferResponseType } from "hono/client";
import { useCallback, useEffect, useState } from "react";
import { useLiff } from "./hooks/useLiff";
import { apiClient } from "./lib/apiClient";
import { createHonoComponent } from "./lib/createHonoComponent";

type Props = {
  liffId: string;
};

type ResponseType = InferResponseType<
  (typeof apiClient.receipts)["$get"],
  200
>;

type Deal = ResponseType["deals"][number];
type PaginationType = ResponseType["pagination"];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    minimumFractionDigits: 0,
  }).format(amount);
};

export const ReceiptList = createHonoComponent(({ liffId }: Props) => {
  const { liff } = useLiff({ liffId });
  const [isLoading, setIsLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(
    async (page: number) => {
      const accessToken = liff?.getAccessToken();
      if (!accessToken) return;

      setIsLoading(true);
      try {
        const res = await apiClient.receipts.$get(
          { query: { page: String(page), limit: "10" } },
          { headers: { Authorization: accessToken } },
        );

        if (res.status === 200) {
          const data = await res.json();
          setDeals(data.deals);
          setPagination(data.pagination);
        } else {
          setError("データの取得に失敗しました");
        }
      } catch {
        setError("データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    },
    [liff],
  );

  useEffect(() => {
    if (liff) {
      fetchDeals(currentPage);
    }
  }, [liff, currentPage, fetchDeals]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <Center h="100vh">
        <Stack align="center">
          <Loader size="lg" />
          <Text c="dimmed">読み込み中...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh">
        <Text c="red">{error}</Text>
      </Center>
    );
  }

  if (!pagination || pagination.totalCount === 0) {
    return (
      <Stack p="md">
        <Title order={3}>領収書が必要な取引</Title>
        <Card shadow="sm" p="lg" radius="md" withBorder>
          <Text c="green" ta="center" fw={500}>
            領収書が必要な取引はありません
          </Text>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack p="md">
      <Group justify="space-between" align="center">
        <Title order={3}>領収書が必要な取引</Title>
        <Badge color="red" size="lg">
          {pagination.totalCount}件
        </Badge>
      </Group>

      <Stack gap="sm">
        {deals.map((deal) => (
          <Card key={deal.id} shadow="sm" p="md" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text c="dimmed" size="sm">
                {deal.date}
              </Text>
              <Text fw={700}>{formatCurrency(deal.amount)}</Text>
            </Group>

            {deal.paymentDescriptions.length > 0 && (
              <Text size="sm" mb="xs" lineClamp={2}>
                {deal.paymentDescriptions.join(" / ")}
              </Text>
            )}

            <Group gap="xs" mb="sm">
              {deal.accountItemNames.map((name) => (
                <Badge key={name} variant="light" size="sm">
                  {name}
                </Badge>
              ))}
            </Group>
            <Button
              component="a"
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              fullWidth
              size="sm"
            >
              freeeで確認
            </Button>
          </Card>
        ))}
      </Stack>

      {pagination.totalPages > 1 && (
        <Center mt="md">
          <Pagination
            value={currentPage}
            onChange={handlePageChange}
            total={pagination.totalPages}
            size="md"
          />
        </Center>
      )}
    </Stack>
  );
});
