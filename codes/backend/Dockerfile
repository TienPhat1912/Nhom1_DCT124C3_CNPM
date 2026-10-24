FROM mcr.microsoft.com/dotnet/sdk:10.0.400 AS build
WORKDIR /src
COPY backend/Hospital.Api/ ./backend/Hospital.Api/
COPY packages/shared/data/ ./packages/shared/data/
RUN dotnet restore backend/Hospital.Api/Hospital.Api.csproj --locked-mode
RUN dotnet publish backend/Hospital.Api/Hospital.Api.csproj -c Release --no-restore -o /app
FROM mcr.microsoft.com/dotnet/aspnet:10.0.13
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Hospital.Api.dll"]
